  VUES.equipe = function (integre) {
    var nomMoi = moi() || 'Moi', p = S.ui.eqPortee || 'semaine', ref = S.ui.eqDate || aujourdhui();
    var dates = p === 'semaine' ? joursOuvres(lundiDe(ref)) : [ref];
    var h = (integre ? '' : '<h2 class="titre-vue">Équipe</h2>') + barreQuiQuand('equipe') +
      (ref !== aujourdhui() ? '<p class="discret" style="margin:-4px 0 10px"><button type="button" class="bouton-texte" data-a="eqAujourdhui">Revenir à aujourd\'hui</button></p>' : '');

    var tout = donneesEquipe(dates);
    var noms = Array.from(new Set(tout.map(function (x) { return x.delegue; }))).sort(function (a, b) {
      return (a === nomMoi ? -1 : b === nomMoi ? 1 : a.localeCompare(b, 'fr'));
    });
    if (!noms.length) return h + '<div class="vide"><strong>Rien sur cette période</strong>Aucune visite planifiée ni réalisée. Choisissez une autre date.</div>';
    var fait = function (x) { return x.statut && Moteur.estVisite(x.statut, statuts()); };
    var nonFait = function (x) { return x.statut && !Moteur.estVisite(x.statut, statuts()); };
    // synthèse par délégué
    var ligne = function (n, l) {
      var conf = l.some(function (x) { return x.programme === 'Validé'; }), nf = l.filter(fait).length, nk = l.filter(nonFait).length, prevu = l.filter(function (x) { return !x.horsTournee; }).length;
      var com = Array.from(new Set(l.map(function (x) { return x.commune; }).filter(Boolean)));
      return '<li><button type="button" data-a="collegue" data-v="' + esc(n) + '" aria-pressed="' + (n === '__tous' ? !sel.length : sel.indexOf(n) >= 0) + '">' +
        '<b>' + esc(n === '__tous' ? 'Toute l\'équipe' : n) + (n === nomMoi ? ' (moi)' : '') + '</b>' +
        (n === '__tous' ? '' : '<span class="etiquette ' + (conf ? 'ok' : '') + '">' + (conf ? 'Tournée confirmée' : (prevu ? 'Brouillon' : 'Hors tournée')) + '</span>') +
        '<span class="discret bloc-texte">' + prevu + ' planifiée' + (prevu > 1 ? 's' : '') + ', ' + nf + ' faite' + (nf > 1 ? 's' : '') +
        (nk ? ', ' + nk + ' non faite' + (nk > 1 ? 's' : '') : '') + (com.length ? ' · ' + esc(libelleCommunes(com)) : '') + '</span></button></li>';
    };
    // sélection : aucun = toute l'équipe ; un ou plusieurs délégués isolés
    var fq = S.ui.fq, sel = fq.qui === 'tous' ? [] : (fq.qui === 'moi' ? [nomMoi] : fq.liste.slice()).filter(function (n) { return noms.indexOf(n) >= 0; });
    if (fq.qui !== 'tous' && !sel.length) return h + '<div class="vide"><strong>Rien sur cette période</strong>Aucune visite pour ' + esc(libelleQui()) + '. Choisissez d\'autres délégués ou une autre date.</div>';
    if (noms.length === 1) sel = [];
    var tous = !sel.length, libSel = tous ? 'Toute l\'équipe' : sel.join(', ');
    if (!tous) {
      h += '<div style="margin:4px 0 8px"><button type="button" class="bouton-texte" data-a="collegueTous">← Revenir à toute l\'équipe</button></div>';
    }
    h += '<ul class="liste resume-equipe">' + noms.map(function (n) { return ligne(n, tout.filter(function (x) { return x.delegue === n; })); }).join('') + '</ul>';

    var siens = tous ? tout : tout.filter(function (x) { return sel.indexOf(x.delegue) >= 0; });
    // semaine : un jour à la fois
    var jour = ref;
    if (p === 'semaine') {
      if (!S.ui.jourEquipe || dates.indexOf(S.ui.jourEquipe) < 0) {
        var t = aujourdhui();
        S.ui.jourEquipe = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return siens.some(function (x) { return x.date === d; }); })[0] || dates[0]);
      }
      jour = S.ui.jourEquipe;
      h += '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
        var l = siens.filter(function (x) { return x.date === d; }), nf = l.filter(fait).length;
        return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jourEquipe" data-v="' + d + '" aria-pressed="' + (d === jour) +
          '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) + '</b><small>' + (nf ? nf + '/' : '') + l.length + ' visite' + (l.length > 1 ? 's' : '') + '</small></button>';
      }).join('') + '</div>';
    }
    var duJour = siens.filter(function (x) { return x.date === jour; });
    var nf = duJour.filter(fait).length;
    h += '<p class="bilan-jour"><b>' + esc(libSel) + '</b>, ' + dateLongue(jour) + ' : ' + duJour.length +
      ' visite' + (duJour.length > 1 ? 's' : '') + ', ' + nf + ' faite' + (nf > 1 ? 's' : '') + '.</p>';
    if (!duJour.length) h += '<p class="discret">Rien de planifié ni de réalisé ce jour-là.</p>';
    // « Toute l'équipe » : une tournée par délégué, l'une sous l'autre
    // plusieurs délégués : un bloc repliable par délégué (ouvert par défaut quand on les a choisis, replié pour toute l'équipe)
    var groupesDel = (tous && noms.length > 1) || sel.length > 1 ? noms.filter(function (n) { return (tous || sel.indexOf(n) >= 0) && duJour.some(function (x) { return x.delegue === n; }); }) : [null];
    var ouverts = S.ui.eqOuverts || (S.ui.eqOuverts = {});
    groupesDel.forEach(function (del) {
    var sesVisites = del ? duJour.filter(function (x) { return x.delegue === del; }) : duJour;
    if (del) {
      var ouvert = ouverts[del] !== undefined ? ouverts[del] : !tous, nfD = sesVisites.filter(fait).length;
      h += '<button type="button" class="groupe-delegue" data-a="eqBascule" data-v="' + esc(del) + '" aria-expanded="' + ouvert + '"><b>' + esc(del) + (del === nomMoi ? ' (moi)' : '') + '</b>' +
        '<small>' + sesVisites.length + ' visite' + (sesVisites.length > 1 ? 's' : '') + ', ' + nfD + ' faite' + (nfD > 1 ? 's' : '') + '</small>' + icone('chevron') + '</button>';
      if (!ouvert) return;
    }
    ['Matin', 'Soir', ''].forEach(function (cren) {
      var liste = sesVisites.filter(function (x) { return cren ? x.creneau === cren : (x.creneau !== 'Matin' && x.creneau !== 'Soir'); })
        .sort(function (a, b) { return String(a.heure || a.debut || '').localeCompare(String(b.heure || b.debut || '')) || String(a.delegue).localeCompare(String(b.delegue)); });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + (cren || 'Autres visites') + '</div><ol class="ligne">';
      liste.forEach(function (x) {
        var ko = nonFait(x), v = x.compte;
        var e = '';
        e += x.statut ? '<span class="etiquette ' + (ko ? 'ko' : 'ok') + '">' + esc(x.statut) + '</span>' : (jour < aujourdhui() ? '<span class="etiquette alerte">Sans compte rendu</span>' : '<span class="etiquette">Prévue</span>');
        if (x.horsTournee) e += '<span class="etiquette">Hors tournée</span>';
        h += '<li class="arret' + (x.statut ? (ko ? ' absent' : ' fait') : '') + '" data-p="' + (+x.note === 3 ? 1 : 3) + '">' +
          '<div class="arret-heure"><b>' + esc(x.heure || '--:--') + '</b><small>' + esc(x.debut || '') + (x.fin ? '-' + esc(x.fin) : '') + '</small></div>' +
          '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
          '<div><div class="arret-carte"><span class="arret-nom">' + lienFiche(x.code, esc(x.nom)) + ' ' + etoiles(x.note) + '</span>' +
          '<span class="arret-lieu">' + esc(x.specialite || '') + (x.lieu ? ', ' + esc(x.lieu) : '') + '</span>' +
          '<span class="arret-lieu">' + esc(x.quartier || '') + (x.commune ? ', ' + esc(x.commune) : '') + '</span>' +
          '<span class="etiquettes">' + e + '</span>' +
          (v && (v.activite || v.produits || v.commentaire) ? '<span class="discret bloc-texte" style="margin-top:6px">' +
            [v.activite ? listeActivites(v.activite).join(', ') : '', v.produits ? 'Produits : ' + v.produits : '', v.commentaire || ''].filter(Boolean).map(esc).join(' · ') + '</span>' : '') +
          '</div></div></li>';
      });
      h += '</ol>';
    });
    });
    // carte du jour, tout en bas
    var pos = duJour.map(function (x) {
      var c = x.idPresence && ctx().parCode[x.code] ? ctx().parCode[x.code].filter(function (k) { return String(k.idPresence) === String(x.idPresence); })[0] : null;
      var co = c && c.coord ? c.coord : (x.lat && x.lon ? { lat: +x.lat, lon: +x.lon } : null);
      return co ? { lat: co.lat, lon: co.lon, nom: ((tous || sel.length > 1) ? x.delegue + ' : ' : '') + x.nom, lieu: x.lieu, heure: x.heure } : null;
    }).filter(Boolean);
    if (pos.length) {
      h += '<h3>Carte de la journée</h3><div class="carte-l" id="carteEquipe"></div>';
      cartesAFaire.push((tous || sel.length > 1) ? { id: 'carteEquipe', equipe: pos.map(function (q) { return { lat: q.lat, lon: q.lon, nom: q.nom, delegue: '' }; }) } : { id: 'carteEquipe', route: pos });
    }
    if (ref < ajouterJours(aujourdhui(), -60)) h += '<p class="discret">Les tournées sont conservées 62 jours ; au-delà, seules les visites faites restent visibles.</p>';
    return h;
  };

  // ------------------------------------------------------------------ Vue : contacts (filtres avancés cumulables)
  function ensemble(l) { var o = {}; (l || []).forEach(function (x) { o[x] = true; }); return o; }
  function aRevoir(p) {
    if (p.prochaine && p.prochaine <= ajouterJours(aujourdhui(), 7)) return true;
    return !!p.statut && (estKo(p.statut) || /rappeler|interess|report/.test(normaliser(p.statut)));
  }
  function filtrerPraticiens(f, texte) {
    var t = aujourdhui(), c = ctx(), q = normaliser(texte || '');
    var sp = ensemble(f.specialites), co = ensemble(f.communes), po = ensemble(f.potentiels);
    return Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (f.type !== 'tous' && p.type !== f.type) return false;
      // spécialités médicales : appliquées aux médecins seulement, sans effet sur les pharmacies (conservées pour « Médecins »)
      if (f.specialites.length && p.type !== 'Pharmacie' && !sp[p.specialite]) return false;
      if (f.potentiels.length && !po[lettrePotentiel(p.note)]) return false;
      if (f.conv === 'oui' && !p.conv) return false;
      if (f.conv === 'non' && p.conv) return false;
      var lieux = c.presencesParCode[p.code] || [];
      if (f.communes.length && !lieux.some(function (x) { return typeof communeCorrespondante === 'function' ? communeCorrespondante(x, co) : co[x.commune]; })) return false;
      if (f.visite !== 'tous') {
        var derDate = p.derniere;
        if (!derDate && S.data && S.data.historique) {
          S.data.historique.forEach(function (hv) {
            if (hv.code === p.code && hv.date && (!derDate || hv.date > derDate)) {
              derDate = String(hv.date).slice(0, 10);
            }
          });
        }
        if (typeof S !== 'undefined' && S.queue && S.queue.length) {
          S.queue.forEach(function (qv) {
            if (qv.code === p.code && qv.date && (!derDate || qv.date > derDate)) {
              derDate = String(qv.date).slice(0, 10);
            }
          });
        }
        var j = derDate ? joursEcoules(derDate, t) : Infinity;
        if (f.visite === '30' && j <= 30) return false;
        if (f.visite === 'recent' && (!derDate || j > 30)) return false;
        if (f.visite === 'jamais' && derDate) return false;
        if (f.visite === 'retard' && j < REGLAGES_MOTEUR.cadence[p.note]) return false;
        if (f.visite === 'revoir' && !aRevoir(p)) return false;
      }
      if (f.equipe !== 'tous' && (f.equipe === 'oui') !== (cibleParCollegues(p.code, t).length > 0)) return false;
      if (!q) return true;

      // 3.25.33 : Recherche dans le Répertoire ciblée sur le praticien
      // 1. Recherche par nom (Dr Kouassi, etc.) ou code (MED-xxx)
      var nomNorm = normaliser(p.nom || '');
      if (nomNorm.indexOf(q) >= 0 || normaliser(p.code || '').indexOf(q) >= 0) return true;

      // 2. Recherche par spécialité (ex: "cardio")
      if (normaliser(p.specialite || '').indexOf(q) >= 0) return true;

      // 3. Lieux / Communes / Quartiers : uniquement à partir de 4 caractères
      // (évite que taper 'kou' pour chercher Kouassi ramène tous les praticiens de Koumassi sans ce nom)
      if (q.length >= 4) {
        var txtLieux = lieux.map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        var mots = normaliser(txtLieux).split(' ');
        if (mots.some(function (w) { return w.indexOf(q) === 0; })) return true;
      }
      return false;
    });
  }
  var LIB_VISITE = { '30': 'Non visité depuis +30 j', recent: 'Visité -30 j', jamais: 'Jamais visité',
                     retard: 'En retard', revoir: 'À revoir' };
  // Liste des critères actifs : [clé, valeur, libellé]
  function criteresActifs(f) {
    var l = [];
    if (f.type !== 'tous') l.push(['type', f.type, f.type === 'Pharmacie' ? 'Pharmacies' : 'Médecins']);
    f.potentiels.forEach(function (x) { l.push(['potentiels', x, ETOILES[x]]); });
    if (f.type !== 'Pharmacie' && !sontToutesSpecialites(f.specialites)) f.specialites.forEach(function (x) { l.push(['specialites', x, x]); });
    f.communes.forEach(function (x) { l.push(['communes', x, x]); });
    if (f.visite !== 'tous') l.push(['visite', f.visite, LIB_VISITE[f.visite]]);
    if (f.conv !== 'tous') l.push(['conv', f.conv, f.conv === 'oui' ? 'Engagés' : 'Non engagés']);
    if (f.equipe !== 'tous') l.push(['equipe', f.equipe, f.equipe === 'oui' ? 'Ciblés par l\'équipe' : 'Non ciblés par l\'équipe']);
    return l;
  }
  var FILTRES_RAPIDES = [['potentiels', 'A', '★★★'], ['visite', 'recent', 'Visité -30 j'], ['visite', '30', 'Non visité +30 j'],
                         ['visite', 'revoir', 'À revoir'], ['visite', 'jamais', 'Jamais visité'], ['conv', 'oui', 'Engagés']];
  function estRapide(k, v) { return FILTRES_RAPIDES.some(function (x) { return x[0] === k && x[1] === v; }); }
  function filtreRapideActif(f, k, v) { return Array.isArray(f[k]) ? f[k].indexOf(v) >= 0 : f[k] === v; }
  function trierPraticiens(liste, tri) {
    var t = aujourdhui();
    return liste.sort(function (a, b) {
      if (tri === 'priorite' || tri === 'potentiel') return b.note - a.note || joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t);
      if (tri === 'retard') return joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t) || b.note - a.note;
      if (tri === 'score') return calcScore(b.note, joursEcoules(b.derniere, t), b.statut) - calcScore(a.note, joursEcoules(a.derniere, t), a.statut);
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
    });
  }

  // Barre de recherche et de filtres commune aux onglets Contacts et Autour
  // Filtres ordonnés comme un arbre de décision : Qui ? > Quelle spécialité ? > Où ? > Quelle valeur ? > Quel suivi ? (> Dans quel ordre ?)
  var QUESTIONS_FILTRES = {
    qui: { titre: 'Qui ?', cles: ['type'] },
    spec: { titre: 'Quelle spécialité ?', cles: ['specialites'] },
    com: { titre: 'Où ?', cles: ['communes'] },
    valeur: { titre: 'Quelle valeur ?', cles: ['potentiels', 'conv'] },
    suivi: { titre: 'Quel suivi ?', cles: ['visite', 'equipe'] },
    ordre: { titre: 'Dans quel ordre ?', cles: [] }
  };
  // Critères posés une question à la fois, comme le compte rendu : les réponses données se replient en une ligne,
  // seule la question en cours est ouverte ; une fois toutes répondues, une seule ligne résume l'ensemble.
  S.ui.etapesF = LS.get('etapesFiltres', {});
  S.ui.rechOuverte = LS.get('rechOuverte', false);
  // dernière question répondue sur la page de recherche : retour aux résultats (les critères se replient en une phrase)
  function finRecherche() {
    if (S.ui.tab !== 'praticiens' || !S.ui.rechOuverte) return false;
    var et = etatEtapes();
    if (!etapesFiltres(S.ui.filtres).every(function (e) { return et.ok[e.id]; })) return false;
    S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre(); window.scrollTo(0, 0); return true;
  }
  function etatEtapes() { var k = cleFiltres(); return S.ui.etapesF[k] || (S.ui.etapesF[k] = { ok: {} }); }
  function sauverEtapes() { LS.set('etapesFiltres', S.ui.etapesF); }
  function puceEtape(k, v, lib, actif, m, auto) {
    return '<button type="button" class="puce" data-a="etapeFiltre" data-k="' + k + '" data-v="' + esc(v) + '" data-m="' + (m ? 1 : 0) + '"' + (auto ? ' data-auto="' + auto + '"' : '') +
      ' aria-pressed="' + actif + '">' + esc(lib) + '</button>';
  }
  function memeEnsembleSpecs(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    var sa = a.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    var sb = b.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    if (sa.length !== sb.length) return false;
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  function etapesFiltres(f) {
    var vis = [['tous', 'Toutes'], ['recent', 'Visité -30 j'], ['30', 'Non visité +30 j'], ['jamais', 'Jamais visité'], ['retard', 'En retard'], ['revoir', 'À revoir']];
    var l = [
      { id: 'qui', auto: true, resume: function () { return f.type === 'Pharmacie' ? 'Pharmacies' : (f.type === 'Médecin' ? 'Médecins' : 'Médecins et pharmacies'); },
        rendu: function () {
          return '<div class="puces">' + [['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']].map(function (x) { return puceEtape('type', x[0], x[1], f.type === x[0], false, 'qui'); }).join('') + '</div>' +
            '<p class="discret raccourcis-titre-etape">Ou directement un raccourci :</p><div class="puces">' + FILTRES_RAPIDES.map(function (x) {
              return '<button type="button" class="puce petite" data-a="filtreRapide" data-fin="1" data-k="' + x[0] + '" data-v="' + x[1] + '" aria-pressed="' + filtreRapideActif(f, x[0], x[1]) + '">' + esc(x[2]) + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'spec', si: f.type !== 'Pharmacie', resume: function () {
          if (!f.specialites.length) return 'Toutes';
          if (memeEnsembleSpecs(f.specialites, coeurDeCible())) return 'Cœur de cible';
          if (sontToutesSpecialites(f.specialites)) return 'Toutes';
          return f.specialites.length <= 2 ? f.specialites.map(abrSpec).join(', ') : f.specialites.slice(0, 2).map(abrSpec).join(', ') + ' +' + (f.specialites.length - 2);
        },
        rendu: function () {
          return '<p class="discret" style="margin:0 0 6px">' + (f.type === 'tous' ? 'Spécialités du cœur de cible pré-sélectionnées (les pharmacies restent affichées) :' : 'Spécialités du cœur de cible pré-sélectionnées (modifier met à jour votre cœur de cible) :') + '</p>' +
            pucesSpecialitesCible(f.specialites, 'filtreSpecToggle', 'filtreSpecToutes', 'filtreSpecCoeur', 'filtreSpecChoisir');
        } },
      { id: 'com', resume: function () { return f.communes.length ? condenserCommunesEtSecteurs(f.communes) : 'Toutes'; },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + (f.communes.length ? esc(condenserCommunesEtSecteurs(f.communes)) : 'Toutes les communes') + '</p>' +
            '<button class="bouton petit" type="button" data-a="filtreQuestion" data-v="com">' + icone('loupe') + 'Choisir les communes</button>';
        } },
      { id: 'valeur', resume: function () {
          var r = f.potentiels.map(function (x) { return ETOILES[x]; }); if (f.conv !== 'tous') r.push(f.conv === 'oui' ? 'Engagés' : 'Non engagés');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Potentiel</span><div class="puces"><button type="button" class="puce puce-tous" data-a="etapeFiltre" data-k="potentiels" data-v="tous" aria-pressed="' + (!f.potentiels.length || f.potentiels.length === 3) + '">Tous</button>' +
            [['A', '★★★'], ['B', '★★'], ['C', '★']].map(function (x) { return puceEtape('potentiels', x[0], x[1], f.potentiels.indexOf(x[0]) >= 0, true); }).join('') + '</div>' +
            '<span class="sous-etape">Engagé</span><div class="puces">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('conv', x[0], x[1], f.conv === x[0]); }).join('') + '</div>';
        } },
      { id: 'suivi', resume: function () {
          var r = []; if (f.visite !== 'tous') r.push(LIB_VISITE[f.visite]);
          if (f.equipe !== 'tous' && !S.config.demo) r.push(f.equipe === 'oui' ? 'Prévus par un collègue' : 'Non prévus par un collègue');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Dernière visite (un seul choix)</span><div class="puces puces-suivi-visite">' + vis.map(function (x) { return puceEtape('visite', x[0], x[1], f.visite === x[0]); }).join('') + '</div>' +
            (S.config.demo ? '' : '<span class="sous-etape">Prévu par un collègue cette semaine</span><div class="puces puces-equipe-semaine">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('equipe', x[0], x[1], f.equipe === x[0]); }).join('') + '</div>');
        } },
      { id: 'ordre', auto: true, si: S.ui.tab === 'praticiens', resume: function () { return TRIS.filter(function (x) { return x[0] === S.ui.tri; }).map(function (x) { return x[1]; })[0] || 'Potentiel'; },
        rendu: function () { return '<div class="puces">' + TRIS.map(function (x) { return puceEtape('tri', x[0], x[1], S.ui.tri === x[0], false, 'ordre'); }).join('') + '</div>'; } }
    ];
    return l.filter(function (e) { return e.si !== false; });
  }
  function barreFiltres(f, q, sansSaisie) {
    var h = sansSaisie ? '' : '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(q) + '" aria-label="Rechercher un praticien"></div></div>';
    var et = etatEtapes(), ok = et.ok, etapes = etapesFiltres(f), n = etapes.length;
    var enCours = etapes.filter(function (e) { return !ok[e.id]; })[0];
    function ligne(e) {
      return '<button type="button" class="cr-fait" data-a="etapeEditer" data-v="' + e.id + '"><span>' + QUESTIONS_FILTRES[e.id].titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>';
    }
    h += '<div class="cr-pas etapes-filtres">';
    if (!enCours) {
      // tout est répondu : une seule ligne, dépliable pour modifier une réponse
      if (et.ouvert) h += etapes.map(ligne).join('') + '<button type="button" class="bouton-texte" data-a="etapesBascule">Replier les critères</button>';
      else h += '<button type="button" class="cr-fait criteres-resume" data-a="etapesBascule"><span>Critères</span><b>' +
        esc(etapes.map(function (e) { return e.id === 'ordre' ? 'tri par ' + e.resume().toLowerCase() : e.resume(); }).filter(function (x) { return x !== 'Toutes' && x !== 'Tous'; }).join(' · ') || 'Aucun') + '</b>' + icone('crayon') + '</button>';
      return h + '</div>';
    }
    etapes.forEach(function (e, i) {
      if (ok[e.id]) { h += ligne(e); return; }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + QUESTIONS_FILTRES[e.id].titre + ' <small>étape ' + (i + 1) + '/' + n + '</small></span>' + e.rendu();
      h += boutonsEtape(i > 0 ? 'etapePrec' : '', i > 0 ? etapes[i - 1].id : '', e.auto ? '' : 'etapePasser', 'etapeOk', e.id, i === n - 1);
      h += '</div>';
    });
    return h + '</div>';
  }

  var ABREV_SPEC = {
    'cardiologie': 'cardio',
    'cardiologue': 'cardio',
    'diabétologie': 'diabéto',
    'diabétologue': 'diabéto',
    'diabetologie': 'diabéto',
    'diabetologue': 'diabéto',
    'gynécologie': 'gynéco',
    'gynécologue': 'gynéco',
    'gynecologie': 'gynéco',
    'gynecologue': 'gynéco',
    'gynécologie obstétrique': 'gynéco-obs',
    'pédiatrie': 'pédia',
    'pédiatre': 'pédia',
    'pediatrie': 'pédia',
    'pediatre': 'pédia',
    'gastro-entérologie': 'gastro',
    'gastro-entérologue': 'gastro',
    'dermatologie': 'dermato',
    'dermatologue': 'dermato',
    'rhumatologie': 'rhumato',
    'rhumatologue': 'rhumato',
    'pneumologie': 'pneumo',
    'pneumologue': 'pneumo',
    'neurologie': 'neuro',
    'neurologue': 'neuro',
    'ophtalmologie': 'ophtalmo',
    'ophtalmologue': 'ophtalmo',
    'psychiatrie': 'psy',
    'psychiatre': 'psy',
    'urologie': 'uro',
    'urologue': 'uro',
    'néphrologie': 'néphro',
    'néphrologue': 'néphro',
    'endocrinologie': 'endocrino',
    'endocrinologue': 'endocrino',
    'orl': 'ORL',
    'oto-rhino-laryngologie': 'ORL',
    'infectiologie': 'infectio',
    'infectiologue': 'infectio',
    'médecine générale': 'MG',
    'médecin généraliste': 'MG',
    'généraliste': 'MG'
  };

  function abbrevSpec(x) {
    if (!x) return '';
    var k = String(x).toLowerCase().trim();
    if (ABREV_SPEC[k]) return ABREV_SPEC[k];
    return x;
  }

  // Résumé des critères retenus, concis et abrégé (ex. « 11 médecins · ★★★ · Cocody · > 30j sans visite »)
  function phraseCriteres(f, q, n, tri) {
    var fem = f.type === 'Pharmacie', pl = n > 1, s = pl ? 's' : '', e = fem ? 'e' : '';
    var nom = f.type === 'Pharmacie' ? 'pharmacie' : (f.type === 'Médecin' ? 'médecin' : 'praticien');
    var t = (n ? n : 'Aucun' + (fem ? 'e' : '')) + ' ' + nom + (pl ? 's' : '');
    var c = [];
    if (f.type !== 'Pharmacie') {
      if (sontToutesSpecialites(f.specialites)) {
        c.push('toutes spécialités');
      } else if (f.specialites.length) {
        t += ' ' + f.specialites.map(function (x) {
          var ab = abbrevSpec(x);
          return pl && !/[sx]$/.test(ab) && !/^[A-Z]+$/.test(ab) ? ab + 's' : ab;
        }).join(' ou ');
        if (f.type === 'tous') t += ' (+ officines)';
      }
    }
    if (f.potentiels.length) c.push(f.potentiels.map(function (x) { return ETOILES[x]; }).join('/'));
    if (f.conv !== 'tous') c.push(f.conv === 'oui' ? 'engagés' : 'non engagés');
    var vis = {
      '30': '> 30j sans visite',
      recent: '< 30j',
      jamais: 'jamais visités',
      retard: 'en retard',
      revoir: 'à revoir'
    };
    if (f.visite !== 'tous') c.push(vis[f.visite] || f.visite);
    if (f.equipe !== 'tous') c.push((f.equipe === 'oui' ? 'prévus' : 'non prévus') + ' collègue');
    if (f.communes.length) {
      var comAffiche = condenserCommunesEtSecteurs(f.communes);
      if (comAffiche) c.push(comAffiche);
    }
    if (q && String(q).trim()) c.push('« ' + String(q).trim() + ' »');
    var lt = { priorite: 'tri potentiel', score: 'tri priorité', retard: 'tri retard', nom: 'tri nom' };
    if (n > 1 && lt[tri]) c.push(lt[tri]);
    var aucunFiltre = f.type === 'tous' && (!f.communes || !f.communes.length) && (!f.potentiels || !f.potentiels.length) &&
                      f.visite === 'tous' && f.conv === 'tous' && f.equipe === 'tous' && (!q || !String(q).trim());
    if (aucunFiltre) {
      return t + ' · Toute la base de données';
    }
    if (!c.length) c.push('Toute la base de données');
    return t + ' · ' + c.join(' · ');
  }

  // 3.27.30 : Répertoire en trois annuaires (Médecins, Pharmacies, Hôpitaux) ; point de retour : avant-repertoire-annuaires
  S.ui.annuaire = LS.get('annuaire', '') === 'hop' ? 'hop' : '';
  function selecteurAnnuaire(f) {
    var prat = ctx().prat, nM = 0, nP = 0;
    Object.keys(prat).forEach(function (k) { if (prat[k].type === 'Pharmacie') nP++; else nM++; });
    var actif = S.ui.annuaire === 'hop' ? 'hop' : (f.type === 'Pharmacie' ? 'ph' : (f.type === 'Médecin' ? 'med' : ''));
    var b = function (v, lib, n) { return '<button type="button" data-a="annuaire" data-v="' + v + '" aria-pressed="' + (actif === v) + '"><b>' + lib + '</b> <span class="sa-n">' + n + '</span></button>'; };
    return '<div class="selecteur-annuaire" role="group" aria-label="Annuaire">' + b('med', 'Médecins', nM) + b('ph', 'Pharmacies', nP) + b('hop', 'Hôpitaux', hopitauxRepertoire().length) + '</div>';
  }
  // établissements (onglet Etablissements) où au moins un médecin est présent, avec leurs médecins
  function hopitauxRepertoire() {
    var c = ctx(), par = {}, l = [];
    ((S.data && S.data.etablissements) || []).forEach(function (e) {
      var nom = String(e.nom || '').trim(), k = normaliser(nom); if (!k || par[k]) return;
      par[k] = { cle: k, nom: nom, commune: e.commune || '', quartier: e.quartier || '', reperes: e.reperes || '', telephone: e.telephone || '',
        lat: parseFloat(String(e.lat || '').replace(',', '.')), lon: parseFloat(String(e.lon || '').replace(',', '.')), codes: {}, pres: [] };
    });
    ((S.data && S.data.presences) || []).forEach(function (x) {
      var p = c.prat[x.code]; if (!p || p.type === 'Pharmacie') return;
      var k = normaliser(x.lieu || ''); if (!k) return;
      var e = par[k] || (par[k] = { cle: k, nom: String(x.lieu).trim(), commune: x.commune || '', quartier: x.quartier || '', reperes: x.reperes || '', telephone: '', lat: NaN, lon: NaN, codes: {}, pres: [] });
      if (!isFinite(e.lat) && aCoord(x)) { var co = lireCoord(x); e.lat = co.lat; e.lon = co.lon; }
      if (!e.codes[x.code]) { e.codes[x.code] = true; e.pres.push(x); }
    });
    // cabinets privés d'un médecin (« Cabinet médical du Dr … ») : restent sur la fiche du médecin, pas dans l'annuaire des hôpitaux
    var cabinet = function (nom) { var x = sansAccents(nom).toLowerCase(); return /cabinet/.test(x) && /\b(dr|docteur|pr|prive)\b/.test(x); };
    Object.keys(par).forEach(function (k) {
      var it = par[k];
      if (!isFinite(it.lat) && typeof trouverEtablissementRef === 'function') {
        var ref = trouverEtablissementRef(it.nom);
        if (ref && isFinite(ref.lat)) { it.lat = ref.lat; it.lon = ref.lon; }
      }
      if (it.pres.length && !cabinet(it.nom)) l.push(it);
    });
    return l;
  }
  function vueHopitaux(f) {
    var q = normaliser(S.ui.rechHop || ''), co = ensemble(f.communes || []), g = gpsFrais(), t = aujourdhui(), jA = jourSemaineIndex(t), c = ctx();
    var debutMois = t.slice(0, 8) + '01';
    var l = hopitauxRepertoire().filter(function (e) {
      if (f.communes && f.communes.length && !communeCorrespondante(e, co)) return false;
      return !q || normaliser(e.nom + ' ' + e.quartier + ' ' + e.commune).indexOf(q) >= 0;
    });
    l.forEach(function (e) { e.d = g && isFinite(e.lat) ? distanceVol(g, { lat: e.lat, lon: e.lon }) : null; });
    l.sort(function (a, b) { return a.nom.localeCompare(b.nom, 'fr'); });
    var h = '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechHop" placeholder="Hôpital, clinique, quartier, commune…" value="' +
      esc(S.ui.rechHop || '') + '" aria-label="Rechercher un hôpital"></div></div>';
    h += '<p class="phrase-criteres" style="text-align:center">' + l.length + ' établissement' + (l.length > 1 ? 's' : '') + (f.communes && f.communes.length ? ' · ' + esc(condenserCommunesEtSecteurs(f.communes) || '') : '') + ' · de A à Z' + '</p>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun établissement</strong>Aucun hôpital ne correspond à cette recherche.</div>';
    h += '<ul class="liste">';
    l.slice(0, S.ui.limite).forEach(function (e) {
      var ouvert = S.ui.hopOuvert === e.cle;
      var vus = e.pres.filter(function (x) { var p = c.prat[x.code]; return p && p.derniere && p.derniere >= debutMois; }).length;
      var ici = e.pres.filter(function (x) { return jA <= 4 && (x[JOURS_CLES[jA]] || ''); }).length;

      var aGpsHop = isFinite(e.lat) && isFinite(e.lon) && e.lat !== 0, clGps = aGpsHop ? 'gps-ok' : 'gps-non';


      var badgeGps = '<span class="etiquette etiquette-gps etiquette-gps-cliquable ' + clGps + '" data-a="capterGpsHopital" data-v="' + esc(e.cle) + '" role="button" tabindex="0" title="' + (aGpsHop ? 'GPS enregistré : toucher pour actualiser' : 'Pas de GPS : toucher pour enregistrer la position') + '" aria-label="' + (aGpsHop ? 'GPS enregistré pour ' : 'Enregistrer le GPS de ') + esc(e.nom) + '">' + icone('carte') + 'GPS</span>';
      var nTot = e.pres.length;
      var txtPres = ici + '/' + nTot + ' médecin' + (nTot > 1 ? 's' : '') + ' présent' + (ici > 1 ? 's' : '') + ' aujourd\'hui';
      var clPres = ici > 0 ? 'etiquette auj' : 'etiquette';
      h += '<li class="element element-hopital"><div class="carte-bouton" data-a="hopital" data-v="' + esc(e.cle) + '" aria-expanded="' + ouvert + '" role="button" tabindex="0">' +
        '<span class="element-titre"><i class="type-pastille t-hop" aria-hidden="true">' + icone('epingle') + '</i>' + esc(e.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc([e.quartier, e.commune].filter(Boolean).join(', ')) + (e.d !== null ? ' · ' + distMoi(e.d) : '') + '</span>' +
        '<span class="etiquettes">' + badgeGps + '<span class="' + clPres + '">' + txtPres + '</span>' +
          (vus ? '<span class="etiquette ok">' + vus + ' vu' + (vus > 1 ? 's' : '') + ' ce mois</span>' : '') +
          '</span></div>';
      if (ouvert) {
        if (e.reperes) h += '<p class="discret" style="margin:6px 0 0">' + esc(e.reperes) + '</p>';
        h += actionsRapides({ telephone: e.telephone, lat: isFinite(e.lat) ? e.lat : null, lon: isFinite(e.lon) ? e.lon : null, lieu: e.nom, quartier: e.quartier, commune: e.commune });
        var ordre = function (x) { var v = jA <= 4 ? (x[JOURS_CLES[jA]] || '') : ''; return v ? 0 : 1; };
        var meds = e.pres.slice().sort(function (a, b) { return ordre(a) - ordre(b) || (+c.prat[b.code].note || 0) - (+c.prat[a.code].note || 0) || String(c.prat[a.code].nom).localeCompare(String(c.prat[b.code].nom), 'fr'); });
        h += '<ul class="hop-medecins">' + meds.map(function (x) {
          var p = c.prat[x.code];
          var jours = JOURS_CLES.map(function (j, i) { var v = lireDispo(x[j]); return v.matin || v.soir ? JOURS[i].slice(0, 3) + ' ' + (v.matin && v.soir ? 'M+S' : (v.matin ? 'M' : 'S')) : ''; }).filter(Boolean).join(' · ');
          var auj = ordre(x) === 0;
          return '<li><button type="button" class="hop-med" data-a="voirContact" data-v="' + esc(p.code) + '">' + nomPrat(p) + ' ' + etoiles(p.note) + (auj ? ' <span class="etiquette auj">Aujourd\'hui</span>' : '') +
            '<small>' + (p.specialite ? '<b class="spec-gras">' + esc(abrSpec(p.specialite)) + '</b>' + (jours ? ' · ' : '') : '') + esc(jours) + '</small></button>' +
            '<button type="button" class="bouton petit" data-a="planifierProchaines" data-v="' + esc(p.code) + '">Planifier</button></li>';
        }).join('') + '</ul>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (l.length > S.ui.limite) h += '<div class="rangee"><button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button></div>';
    return h;
  }
  // 3.27.37 : Disponibilité en temps réel à l'instant T pour un médecin (Présent vert / Absent rouge)
  function badgePresenceMedecin(code, p) {
    var t = aujourdhui(), jA = jourSemaineIndex(t);
    if (jA <= 4 && !estFerie(t) && !absentLe(p, t)) {
      var now = minutesMaintenant();
      var crs = (ctx().parCode[code] || []);
      for (var i = 0; i < crs.length; i++) {
        var cr = crs[i];
        if (cr.jourIdx === jA && now >= cr.debut && now <= cr.fin) {
          var lieuTxt = cr.lieu ? ' (' + abregerHopital(cr.lieu) + ')' : '';
          return '<span class="etiquette ok" title="Présent actuellement en consultation' + esc(lieuTxt) + '">Présent</span>';
        }
      }
    }
    return '<span class="etiquette ko" title="Actuellement hors créneau de consultation">Absent</span>';
  }

