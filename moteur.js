/* =============================================================================
   moteur.js : planification sous contraintes horaires (version 3)
   Tourne entièrement sur le téléphone (fonctionne hors ligne). Dépend de commun.js.

   Principe
   - Chaque présence d'un praticien (lieu x jour x Matin/Soir) devient un « créneau »
     avec une fenêtre horaire [début, fin].
   - Une journée est construite par insertion : on part des arrêts imposés ou conservés,
     puis on insère à chaque étape le praticien qui apporte le plus de valeur
     (score de potentiel et de retard, moins le détour en km), à la meilleure place
     de la tournée, à condition que toutes les visites restent réalisables dans
     leurs fenêtres horaires (trajet + attente + 20 min de visite).
   ============================================================================= */

var Moteur = (function () {
  var R = REGLAGES_MOTEUR;

  function bas(s) { return String(s || '').trim().toLowerCase(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function inactif(p) { var t = normaliser(p.actif); return t === 'non' || t === 'n' || t === '0'; }

  // ------------------------------------------------------------------ Contexte
  // data : { praticiens, presences, quartiers }
  function preparer(data) {
    var idxQ = {};
    (data.quartiers || []).forEach(function (q) { idxQ[bas(q.quartier)] = q; });
    var prat = {};
    (data.praticiens || []).forEach(function (p) {
      if (!p.code || inactif(p)) return;
      p.note = lireNote(p.note);
      p.conv = estConventionne(p.conventionne);
      prat[p.code] = p;
    });
    // Fiabilité de chaque lieu : part des visites où le praticien était présent (dès 3 comptes rendus)
    var stats = {}, sts = data.statuts && data.statuts.length ? data.statuts : STATUTS_DEFAUT;
    (data.historique || []).forEach(function (v) {
      if (!v.idPresence) return;
      var k = String(v.idPresence), x = stats[k] = stats[k] || { n: 0, ok: 0 };
      x.n++; if (estVisite(v.statut, sts)) x.ok++;
    });
    var feries = {};
    (data.feries && data.feries.length ? data.feries : FERIES_DEFAUT).forEach(function (d) { feries[d] = true; });
    var parJour = [[], [], [], [], []], parCode = {}, presencesParCode = {};
    (data.presences || []).forEach(function (pr) {
      var p = prat[pr.code];
      if (!p) return;
      (presencesParCode[pr.code] = presencesParCode[pr.code] || []).push(pr);
      var q = idxQ[bas(pr.quartier)];
      var lat = parseFloat(String(pr.lat).replace(',', '.')), lon = parseFloat(String(pr.lon).replace(',', '.'));
      var coord = isFinite(lat) && isFinite(lon) && lat !== 0 ? { lat: lat, lon: lon } : (q ? { lat: q.lat, lon: q.lon } : null);
      var hM = lireHoraire(pr.horaireMatin, R.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, R.horaireSoirDefaut);
      var st = stats[String(pr.id)], fiab = st && st.n >= 3 ? st.ok / st.n : 1;
      JOURS_CLES.forEach(function (cle, j) {
        var d = lireDispo(pr[cle]);
        [['Matin', d.matin, hM], ['Soir', d.soir, hS]].forEach(function (x) {
          if (!x[1]) return;
          var c = {
            cle: pr.id + '|' + j + '|' + x[0], idPresence: pr.id, code: pr.code, jourIdx: j, jour: JOURS[j],
            creneau: x[0], debut: x[2][0], fin: x[2][1], lieu: pr.lieu, quartier: pr.quartier,
            commune: pr.commune || (q && q.commune) || '', zone: pr.zone || (q && q.zone) || '', coord: coord, prat: p,
            fiab: fiab, fiabTexte: st && st.n >= 3 ? st.ok + '/' + st.n : ''
          };
          parJour[j].push(c);
          (parCode[pr.code] = parCode[pr.code] || []).push(c);
        });
      });
    });
    Object.keys(parCode).forEach(function (k) {
      parCode[k].sort(function (a, b) { return a.jourIdx - b.jourIdx || a.debut - b.debut; });
    });
    return { prat: prat, parJour: parJour, parCode: parCode, presencesParCode: presencesParCode, idxQ: idxQ,
             quartiers: data.quartiers || [], feries: feries };
  }

  function creneauParCle(ctx, cle) {
    var code = null;
    for (var j = 0; j < 5; j++) {
      for (var i = 0; i < ctx.parJour[j].length; i++) if (ctx.parJour[j][i].cle === cle) return ctx.parJour[j][i];
    }
    return code;
  }

  // Score : potentiel + retard de visite + bonus si une « prochaine étape » est arrivée à échéance
  function scoreDe(p, date) {
    var s = calcScore(p.note, joursEcoules(p.derniere, date), p.statut);
    if (p.prochaine && p.prochaine <= date) s += 120;
    return s;
  }

  // Arrêt de tournée (objet simple, enregistrable sur le téléphone)
  function arretDepuisCreneau(c, date) {
    var p = c.prat;
    return {
      uid: uid(), date: date, jour: c.jour, creneau: c.creneau, cle: c.cle, idPresence: c.idPresence,
      debut: minutesVersHeure(c.debut), fin: minutesVersHeure(c.fin), heure: minutesVersHeure(c.debut),
      code: p.code, nom: p.nom, type: p.type, specialite: p.specialite, note: p.note, conventionne: p.conv ? 'Oui' : 'Non',
      lieu: c.lieu, quartier: c.quartier, commune: c.commune, zone: c.zone,
      lat: c.coord ? c.coord.lat : null, lon: c.coord ? c.coord.lon : null,
      derniere: p.derniere || '', joursEcoules: joursEcoules(p.derniere, date), score: scoreDe(p, date),
      prochaine: p.prochaine || '', fiab: c.fiab === undefined ? 1 : c.fiab, fiabTexte: c.fiabTexte || '',
      dist: 0, statut: '', commentaire: '', etat: '', garde: false, impose: false, rdv: '', retard: false
    };
  }

  // ------------------------------------------------------------------ Simulation horaire
  function item(a) {
    var rdv = heureVersMinutes(a.rdv);
    return { a: a, coord: a.lat !== null && a.lat !== undefined && a.lat !== '' ? { lat: +a.lat, lon: +a.lon } : null,
             tot: rdv !== null ? rdv : heureVersMinutes(a.debut),
             tard: rdv !== null ? rdv + R.toleranceRdv : heureVersMinutes(a.fin) - R.dureeVisite };
  }
  function dist(x, y) { return x && y ? distanceKm(x.coord, y.coord) : 0; }

  // Retourne pour chaque arrêt l'heure de début de visite et un indicateur de retard
  // (trajets : vol d'oiseau x 1,3, 3 min/km, plus lents aux heures de pointe, + traversée de la lagune)
  function trajetMin(prev, it, t) { return prev ? minutesTrajet(dist(prev, it), prev.a.commune, it.a.commune, t) : 0; }
  function simuler(items) {
    var t = null, prev = null, debuts = [], retards = [], nbRetards = 0;
    items.forEach(function (it) {
      var trajet = trajetMin(prev, it, t);
      var arrivee = t === null ? it.tot : t + trajet;
      var deb = Math.max(arrivee, it.tot);
      var enRetard = deb > it.tard;
      debuts.push(deb); retards.push(enRetard); if (enRetard) nbRetards++;
      t = deb + R.dureeVisite; prev = it;
    });
    return { debuts: debuts, retards: retards, nbRetards: nbRetards };
  }

  function delta(route, i, it, depart) {
    var prev = i > 0 ? route[i - 1] : depart, next = i < route.length ? route[i] : null;
    return (prev ? dist(prev, it) : 0) + (next ? dist(it, next) : 0) - (prev && next ? dist(prev, next) : 0);
  }

  // Insère un élément à la meilleure place réalisable (ou, à défaut, à la moins mauvaise)
  function insererAuMieux(route, it, depart) {
    var base = simuler(route).nbRetards, best = null;
    for (var i = 0; i <= route.length; i++) {
      var essai = route.slice(0, i).concat([it], route.slice(i));
      var s = simuler(essai), d = delta(route, i, it, depart);
      var cout = (s.nbRetards - base) * 1000 + d;
      if (!best || cout < best.cout) best = { cout: cout, route: essai };
    }
    return best.route;
  }

  // ------------------------------------------------------------------ Itinéraire de la journée
  // 1. les praticiens d'un même établissement sont vus à la suite (du plus pressé au moins pressé) ;
  // 2. les établissements s'enchaînent de proche en proche, en partant du point de départ ;
  // 3. les horaires de présence priment : aucun ordre ne doit faire arriver après la fin d'une présence.
  // Jusqu'à 8 établissements, tous les ordres sont comparés ; au-delà, proche en proche puis améliorations 2-opt.
  function cleLieu(it) { return normaliser(it.a.lieu || '') + '|' + bas(it.a.quartier) + '|' + it.a.creneau; }
  function coutOrdre(route, depart) {
    var s = simuler(route), km = 0, attente = 0, t = null, prev = depart, vus = {}, coupes = 0, cle = null;
    route.forEach(function (it, i) {
      km += prev ? dist(prev, it) : 0;
      if (t !== null) attente += Math.max(0, s.debuts[i] - (t + trajetMin(route[i - 1], it, t)));
      t = s.debuts[i] + R.dureeVisite; prev = it;
      var k = cleLieu(it);
      if (k !== cle && vus[k]) coupes++;      // revenir dans un établissement déjà quitté
      vus[k] = true; cle = k;
    });
    // retards interdits ; établissement scindé fortement pénalisé ; puis kilomètres, l'attente comptant peu
    return { retards: s.nbRetards, cout: s.nbRetards * 1000 + coupes * 50 + km + attente / 60 };
  }
  function ordonnerItems(items, depart) {
    if (items.length < 2) return items.slice();
    var groupes = [], idx = {};
    items.forEach(function (it) {
      var k = cleLieu(it);
      if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push([]); }
      groupes[idx[k]].push(it);
    });
    groupes.forEach(function (g) { g.sort(function (a, b) { return a.tard - b.tard || a.tot - b.tot; }); });
    function aplatir(ordre) { var r = []; ordre.forEach(function (g) { r = r.concat(g); }); return r; }
    var best = null;
    function evaluer(ordre) {
      var r = aplatir(ordre), c = coutOrdre(r, depart);
      if (!best || c.cout < best.c.cout) best = { r: r, c: c };
    }
    if (groupes.length <= 8) {
      (function permuter(reste, pris) {
        if (!reste.length) { evaluer(pris); return; }
        for (var i = 0; i < reste.length; i++) permuter(reste.slice(0, i).concat(reste.slice(i + 1)), pris.concat([reste[i]]));
      })(groupes, []);
    } else {
      // proche en proche, en tenant compte des horaires
      var reste = groupes.slice(), ordre = [];
      while (reste.length) {
        var meilleur = null;
        reste.forEach(function (g, i) {
          var c = coutOrdre(aplatir(ordre.concat([g])), depart);
          if (!meilleur || c.cout < meilleur.c) meilleur = { c: c.cout, i: i };
        });
        ordre.push(reste.splice(meilleur.i, 1)[0]);
      }
      evaluer(ordre);
      for (var tour = 0, ameliore = true; ameliore && tour < 20; tour++) {
        ameliore = false;
        for (var i = 0; i < ordre.length - 1; i++) {
          for (var j = i + 1; j < ordre.length; j++) {
            var essai = ordre.slice(0, i).concat(ordre.slice(i, j + 1).reverse(), ordre.slice(j + 1));
            var avant = best.c.cout; evaluer(essai);
            if (best.c.cout < avant) { ordre = essai; ameliore = true; }
          }
        }
      }
    }
    return best.r;
  }
  // Ordre retenu : le regroupement par établissement, sauf s'il crée plus de retards que l'ordre d'origine
  function meilleurOrdre(route, depart) {
    if (route.length < 2) return route;
    var nouveau = ordonnerItems(route, depart);
    return coutOrdre(nouveau, depart).cout <= coutOrdre(route, depart).cout ? nouveau : route;
  }

  // Ordonne une liste d'arrêts d'une même journée (après ajout, retrait, nouveau tirage)
  function ordonnerJour(arrets, depart) {
    var its = arrets.map(item).sort(function (a, b) { return a.tot - b.tot || a.tard - b.tard; });
    var route = [], dep = depart ? { coord: depart } : null;
    its.forEach(function (it) { route = insererAuMieux(route, it, dep); });
    return finaliser(meilleurOrdre(route, dep));
  }

  function finaliser(route) {
    var s = simuler(route);
    return route.map(function (it, i) {
      var a = it.a;
      a.heure = minutesVersHeure(s.debuts[i]);
      a.retard = s.retards[i];
      a.dist = i > 0 ? Math.round(dist(route[i - 1], it) * 10) / 10 : 0;
      a.trajet = i > 0 ? trajetMin(route[i - 1], it, s.debuts[i - 1] + R.dureeVisite) : 0;
      return a;
    });
  }

  // ------------------------------------------------------------------ Construction d'une journée
  // o : { communes: [..] | null, maxJour, delai, exclus: {code}, rejetes: {code}, fixes: [arrêts], depart: {lat,lon} | null }
  function planifierJour(ctx, date, o, utilises) {
    var j = jourSemaineIndex(date);
    var depart = o.depart ? { coord: o.depart } : null;
    var route = [];
    (o.fixes || []).slice().sort(function (a, b) { return item(a).tot - item(b).tot; })
      .forEach(function (a) { route = insererAuMieux(route, item(a), depart); });
    if (j > 4 || (ctx.feries && ctx.feries[date])) return finaliser(route);

    var dans = null;
    if (o.communes && o.communes.length) { dans = {}; o.communes.forEach(function (c) { dans[c] = true; }); }
    var cands = [];
    ctx.parJour[j].forEach(function (c) {
      if (utilises[c.code] || (o.exclus && o.exclus[c.code])) return;
      if (dans && !dans[c.commune]) return;
      if (o.accepte && !o.accepte(c.prat)) return;
      if (absentLe(c.prat, date)) return;
      var je = joursEcoules(c.prat.derniere, date);
      if (je < (o.delai || 0)) return;
      var a = arretDepuisCreneau(c, date);
      // un lieu où le praticien est souvent absent passe après les autres
      cands.push({ a: a, it: item(a), score: a.score * (0.5 + 0.5 * a.fiab), rejete: !!(o.rejetes && o.rejetes[c.code]) });
    });

    var max = o.maxJour || 8;
    function passe(avecRejetes) {
      while (route.length < max) {
        var dansRoute = {};
        route.forEach(function (it) { dansRoute[it.a.code] = true; });
        var base = simuler(route).nbRetards, options = [];
        cands.forEach(function (cd) {
          if (dansRoute[cd.a.code] || (cd.rejete && !avecRejetes)) return;
          for (var i = 0; i <= route.length; i++) {
            options.push({ v: cd.score - R.penaliteKm * delta(route, i, cd.it, depart), cd: cd, i: i });
          }
        });
        if (!options.length) return;
        options.sort(function (x, y) { return y.v - x.v; });
        var pris = false;
        for (var k = 0; k < options.length && k < 4000; k++) {
          var op = options[k];
          var essai = route.slice(0, op.i).concat([op.cd.it], route.slice(op.i));
          var s = simuler(essai);
          if (!s.retards[op.i] && s.nbRetards <= base) { route = essai; pris = true; break; }
        }
        if (!pris) return;
      }
    }
    passe(false);
    if (route.length < max) passe(true);
    route.forEach(function (it) { utilises[it.a.code] = true; });
    return finaliser(meilleurOrdre(route, depart));
  }

  // ------------------------------------------------------------------ Planning d'une période
  // p : { dates, communesPour(date), maxJour, delai, exclus, rejetes, conserves: [arrêts],
  //       imposes: [{ code, date?, cle?, rdv? }], depart, accepte(praticien) : filtre spécialités / types }
  function genererPlanning(ctx, p) {
    var utilises = {}, fixes = {}, nonPlaces = [];
    p.dates.forEach(function (d) { fixes[d] = []; });
    (p.conserves || []).forEach(function (a) {
      utilises[a.code] = true;
      if (fixes[a.date]) fixes[a.date].push(a);
    });

    (p.imposes || []).forEach(function (im) {
      if (utilises[im.code]) return;
      var rdv = heureVersMinutes(im.rdv), options = [];
      p.dates.forEach(function (d) {
        var j = jourSemaineIndex(d);
        if (j > 4 || (im.date && im.date !== d) || (im.apres && d < im.apres) || (ctx.feries && ctx.feries[d])) return;
        (ctx.parCode[im.code] || []).forEach(function (c) {
          if (c.jourIdx === j && (!im.cle || im.cle === c.cle)) options.push({ d: d, c: c });
        });
      });
      if (!options.length) { nonPlaces.push(im); return; }
      options.sort(function (x, y) {
        var cx = rdv !== null && x.c.debut <= rdv && rdv <= x.c.fin ? 0 : 1;
        var cy = rdv !== null && y.c.debut <= rdv && rdv <= y.c.fin ? 0 : 1;
        return cx - cy || fixes[x.d].length - fixes[y.d].length || (x.d < y.d ? -1 : x.d > y.d ? 1 : 0) || x.c.debut - y.c.debut;
      });
      var o = options[0], a = arretDepuisCreneau(o.c, o.d);
      a.impose = true; a.garde = true; if (im.etape) a.etape = true;
      if (rdv !== null) a.rdv = minutesVersHeure(rdv);
      fixes[o.d].push(a);
      utilises[im.code] = true;
    });

    var arrets = [];
    p.dates.forEach(function (d) {
      arrets = arrets.concat(planifierJour(ctx, d, {
        communes: p.communesPour ? p.communesPour(d) : null, maxJour: p.maxJour, delai: p.delai,
        exclus: p.exclus, rejetes: p.rejetes, fixes: fixes[d], depart: p.depart, accepte: p.accepte
      }, utilises));
    });
    return { arrets: arrets, nonPlaces: nonPlaces };
  }

  // ------------------------------------------------------------------ Autour de moi
  // Praticiens présents autour d'une position un jour donné, selon leur propre planning.
  // minute : heure courante en minutes (null = toute la journée)
  function autourDe(ctx, pos, date, minute, rayon) {
    var j = jourSemaineIndex(date);
    if (j > 4 || !pos) return [];
    var meilleurs = {};
    ctx.parJour[j].forEach(function (c) {
      var pharma = c.prat && c.prat.type === 'Pharmacie';
      var d = distanceKm(pos, c.coord);
      if (d > rayon) return;
      var fin = pharma ? c.fin : c.fin - R.dureeVisite;
      var etat = minute === null ? (c.creneau === 'Matin' ? 'matin' : 'soir') :
        (c.debut <= minute && minute <= fin ? 'present' : (c.debut > minute ? 'plustard' : 'termine'));
      if (etat === 'termine') return;
      var ordre = etat === 'present' || etat === 'matin' ? 0 : 1;
      var x = { c: c, dist: d, etat: etat, score: scoreDe(c.prat, date), ordre: ordre };
      var k = c.code, m = meilleurs[k];
      if (!m || x.ordre < m.ordre || (x.ordre === m.ordre && x.dist < m.dist)) meilleurs[k] = x;
    });
    return Object.keys(meilleurs).map(function (k) { return meilleurs[k]; }).sort(function (a, b) {
      return a.ordre - b.ordre || (a.ordre === 1 && minute !== null ? a.c.debut - b.c.debut : 0) ||
        Math.floor(a.dist) - Math.floor(b.dist) || b.score - a.score;
    });
  }

  function quartierLePlusProche(lat, lon, quartiers) {
    var best = null, bestD = Infinity, p = { lat: lat, lon: lon };
    (quartiers || []).forEach(function (q) {
      var d = distanceKm(p, q) / R.detourRoutier;
      if (d < bestD) { bestD = d; best = q; }
    });
    return best ? { quartier: best, km: bestD } : null;
  }

  // ------------------------------------------------------------------ Couverture géographique
  // mesArrets / arretsEquipe : arrêts sur les dates considérées
  function couverture(ctx, dates, mesArrets, arretsEquipe) {
    var jours = {};
    dates.forEach(function (d) { var j = jourSemaineIndex(d); if (j < 5) jours[j] = d; });
    var communes = {}, ordreZones = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest'];
    ctx.quartiers.forEach(function (q) {
      if (!communes[q.commune]) communes[q.commune] = { commune: q.commune, zone: q.zone, moi: 0, equipe: {}, dispo: {}, prioritaires: {} };
    });
    mesArrets.forEach(function (a) { if (communes[a.commune]) communes[a.commune].moi++; });
    arretsEquipe.forEach(function (a) {
      var c = communes[a.commune]; if (!c) return;
      c.equipe[a.delegue] = (c.equipe[a.delegue] || 0) + 1;
    });
    Object.keys(jours).forEach(function (j) {
      ctx.parJour[j].forEach(function (cr) {
        var c = communes[cr.commune]; if (!c) return;
        c.dispo[cr.code] = true;
        if (cr.prat.note === 3 && joursEcoules(cr.prat.derniere, jours[j]) >= R.cadence[3]) c.prioritaires[cr.code] = true;
      });
    });
    return Object.keys(communes).map(function (k) {
      var c = communes[k];
      return { commune: c.commune, zone: c.zone, moi: c.moi, equipe: c.equipe,
               nbEquipe: Object.keys(c.equipe).reduce(function (s, n) { return s + c.equipe[n]; }, 0),
               dispo: Object.keys(c.dispo).length, prioritaires: Object.keys(c.prioritaires).length };
    }).sort(function (a, b) {
      return ordreZones.indexOf(a.zone) - ordreZones.indexOf(b.zone) || a.commune.localeCompare(b.commune, 'fr');
    });
  }

  // ------------------------------------------------------------------ Visites
  function estVisite(statut, statuts) {
    var s = (statuts && statuts.length ? statuts : STATUTS_DEFAUT);
    for (var i = 0; i < s.length; i++) if (s[i].nom === statut) return !!s[i].visite;
    return false;
  }
  function appliquerVisite(praticiens, v, statuts) {
    var compte = estVisite(v.statut, statuts);
    praticiens.forEach(function (p) {
      if (p.code !== v.code) return;
      if (compte) {
        if (!p.derniere || v.date > p.derniere) p.derniere = v.date;
        p.nbVisites = (+p.nbVisites || 0) + 1;
      }
      p.prochaine = v.prochaine || '';
      p.statut = v.statut;
      p.commentaire = v.commentaire || '';
    });
  }

  return {
    preparer: preparer, creneauParCle: creneauParCle, arretDepuisCreneau: arretDepuisCreneau, scoreDe: scoreDe,
    simuler: simuler, ordonnerJour: ordonnerJour, planifierJour: planifierJour, genererPlanning: genererPlanning,
    autourDe: autourDe, quartierLePlusProche: quartierLePlusProche, couverture: couverture,
    estVisite: estVisite, appliquerVisite: appliquerVisite, item: item, uid: uid
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
