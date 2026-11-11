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
      if (p.type !== 'Pharmacie' && typeof specialiteCanonique === 'function') p.specialite = specialiteCanonique(p.specialite);
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
    var idsVus = {};
    (data.presences || []).forEach(function (pr, i) {
      // 3.26.50 : identifiant en double (base corrigée à la main) : rendu unique, sinon deux lieux s'échangent à l'écran
      if (pr.id === undefined || pr.id === '' || idsVus[String(pr.id)]) pr.id = 'L' + (i + 2) + '-' + pr.code;
      idsVus[String(pr.id)] = true;
      var p = prat[pr.code];
      if (!p) return;
      (presencesParCode[pr.code] = presencesParCode[pr.code] || []).push(pr);
      var q = idxQ[bas(pr.quartier)];
      var coord = lireCoord(pr);
      if (coord && typeof estCommuneInterieur === 'function' && estCommuneInterieur(pr.commune) && typeof estCoordonneeAbidjan === 'function' && estCoordonneeAbidjan(coord)) {
        coord = null;
      }
      if (!coord) {
        coord = q ? { lat: q.lat, lon: q.lon, approx: true } : (typeof centroideVilleInterieur === 'function' ? (centroideVilleInterieur(pr.commune) || centroideVilleInterieur(pr.quartier)) : null);
        if (coord && !coord.approx) coord = { lat: coord.lat, lon: coord.lon, approx: true };
      }
      var hM = lireHoraire(pr.horaireMatin, R.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, R.horaireSoirDefaut);
      var st = stats[String(pr.id)], fiab = st && st.n >= 3 ? st.ok / st.n : 1;
      JOURS_CLES.forEach(function (cle, j) {
        var d = lireDispo(pr[cle]);
        [['Matin', d.matin, hM], ['Soir', d.soir, hS]].forEach(function (x) {
          if (!x[1]) return;
          var c = {
            cle: pr.id + '|' + j + '|' + x[0], idPresence: pr.id, code: pr.code, jourIdx: j, jour: JOURS[j],
            creneau: x[0], debut: x[2][0], fin: x[2][1], lieu: pr.lieu, quartier: pr.quartier, reperes: pr.reperes || '',
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
      lieu: c.lieu, quartier: c.quartier, reperes: c.reperes || '', commune: c.commune, zone: c.zone,
      lat: c.coord ? c.coord.lat : null, lon: c.coord ? c.coord.lon : null,
      derniere: p.derniere || '', joursEcoules: joursEcoules(p.derniere, date), score: scoreDe(p, date),
      prochaine: p.prochaine || '', fiab: c.fiab === undefined ? 1 : c.fiab, fiabTexte: c.fiabTexte || '',
      dist: 0, statut: '', commentaire: '', etat: '', garde: false, impose: false, rdv: '', retard: false
    };
  }

  // ------------------------------------------------------------------ Simulation horaire
  function item(a) {
    // rdv : heure imposée ; fixe : visite déjà faite, laissée à son heure ; avance : visite ramenée « maintenant » (GPS)
    // 3.25.0 : les heures proposées restent dans la journée de travail (R.debutTravail - R.finTravail) ;
    // une visite déjà faite garde son heure réelle mais ne décale pas les suivantes hors de cette plage
    var coord = a.lat !== null && a.lat !== undefined && a.lat !== '' ? { lat: +a.lat, lon: +a.lon } : null;
    var fixe = heureVersMinutes(a.fixe);
    if (fixe !== null) return { a: a, coord: coord, tot: fixe, tard: fixe + R.toleranceRdv, fixe: true };
    var rdv = heureVersMinutes(a.rdv || a.avance), deb = heureVersMinutes(a.debut), fin = heureVersMinutes(a.fin);
    var tot = rdv !== null ? rdv : (deb === null ? R.debutTravail : deb);
    var tard = rdv !== null ? rdv + R.toleranceRdv : (fin === null ? R.finTravail : fin) - R.dureeVisite;
    return { a: a, coord: coord, tot: Math.max(tot, R.debutTravail), tard: Math.min(tard, R.finTravail - R.dureeVisite) };
  }
  function dist(x, y) { return x && y ? distanceKm(x.coord, y.coord) : 0; }

  // Retourne pour chaque arrêt l'heure de début de visite et un indicateur de retard
  // (trajets : vol d'oiseau x 1,3, 3 min/km, plus lents aux heures de pointe, + traversée de la lagune)
  function trajetMin(prev, it, t) { return prev ? minutesTrajet(dist(prev, it), prev.a.commune, it.a.commune, t) : 0; }
  function simuler(items) {
    var t = null, prev = null, debuts = [], retards = [], nbRetards = 0;
    items.forEach(function (it) {
      if (it.fixe) {   // visite faite : son heure réelle, sans retard ; elle ne pousse les suivantes que dans la plage de travail
        debuts.push(it.tot); retards.push(false);
        if (it.tot >= R.debutTravail && it.tot <= R.finTravail) { t = Math.max(t === null ? 0 : t, it.tot + R.dureeVisite); prev = it; }
        return;
      }
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
  // 1. Les praticiens d'un même établissement (sur le même créneau Matin/Soir) sont vus à la suite ;
  // 2. Zéro aller-retour (back-and-forth) : on termine tous les médecins d'un quartier/secteur avant d'en sortir ;
  // 3. Les horaires de présence et fenêtres de travail priment : aucun ordre ne doit créer de retard.
  // Jusqu'à 9 blocs d'établissement : TSP exact par Branch & Bound (élagage admissible) ;
  // Au-delà : plus proche voisin sensible aux zones, puis améliorations 2-opt et Or-opt (déplacement de bloc).
  function creneauDeItem(it) { return it.a.creneau || (it.tot < 780 ? 'Matin' : 'Soir'); }
  function cleBlocLieu(it) {
    var a = it.a, cr = creneauDeItem(it);
    return cleNorm(a.lieu) ? cleNorm(a.lieu) + '|' + cleNorm(a.commune) + '|' + cr : 'u|' + (a.uid || a.code) + '|' + cr;
  }
  function coutOrdre(route, depart) {
    var s = simuler(route), km = 0, attente = 0, t = null, prev = depart;
    var vusEtab = {}, cleEtabPrev = null, coupesEtab = 0;
    var vusQCren = {}, cleQCrenPrev = null, coupesQuartierCren = 0;
    var vusZCren = {}, cleZCrenPrev = null, coupesZoneCren = 0;
    var vusQJour = {}, cleQJourPrev = null, coupesQuartierJour = 0;
    route.forEach(function (it, i) {
      km += prev ? dist(prev, it) : 0;
      if (t !== null) attente += Math.max(0, s.debuts[i] - (t + trajetMin(route[i - 1], it, t)));
      t = s.debuts[i] + R.dureeVisite; prev = it;
      var cr = creneauDeItem(it);
      var ke = cleEtablissement(it) + '|' + cr;
      if (ke !== cleEtabPrev && vusEtab[ke]) coupesEtab++;
      vusEtab[ke] = true; cleEtabPrev = ke;
      var kq = cleQuartier(it), kqc = kq + '|' + cr;
      if (kqc !== cleQCrenPrev && vusQCren[kqc]) coupesQuartierCren++;
      vusQCren[kqc] = true; cleQCrenPrev = kqc;
      if (kq !== cleQJourPrev && vusQJour[kq]) coupesQuartierJour++;
      vusQJour[kq] = true; cleQJourPrev = kq;
      var kzc = cleSecteurTournee(it) + '|' + cr;
      if (kzc !== cleZCrenPrev && vusZCren[kzc]) coupesZoneCren++;
      vusZCren[kzc] = true; cleZCrenPrev = kzc;
    });
    // Priorité absolue : 0 retard (*1000) > 0 retour dans un établissement quitté (*80) >
    // 0 aller-retour quartier (*35) et secteur (*25) dans la demi-journée > continuité inter-créneaux (*6) > km + attente
    return {
      retards: s.nbRetards,
      cout: s.nbRetards * 1000 + coupesEtab * 80 + coupesQuartierCren * 35 + coupesZoneCren * 25 + coupesQuartierJour * 6 + km + attente / 60
    };
  }
  function ordonnerItems(items, depart) {
    if (items.length < 2) return items.slice();
    var fixes = [], libres = [];
    items.forEach(function (it) { if (it.fixe) fixes.push(it); else libres.push(it); });
    if (libres.length < 2) return fixes.concat(libres);
    var groupes = [], idx = {};
    libres.forEach(function (it) {
      var k = cleBlocLieu(it);
      if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push([]); }
      groupes[idx[k]].push(it);
    });
    groupes.forEach(function (g) { g.sort(function (a, b) { return a.tard - b.tard || a.tot - b.tot; }); });
    function aplatir(ordre) {
      var r = fixes.slice();
      ordre.forEach(function (g) { r = r.concat(g); });
      return r;
    }
    var best = null;
    function evaluer(ordre) {
      var r = aplatir(ordre), c = coutOrdre(r, depart);
      if (!best || c.cout < best.c.cout) best = { r: r, c: c };
    }
    if (groupes.length <= 9) {
      (function permuter(reste, pris) {
        if (!reste.length) { evaluer(pris); return; }
        if (best && pris.length >= 2) {
          var lb = coutOrdre(aplatir(pris), depart);
          if (lb.cout >= best.c.cout - 1e-6) return;   // Branch & Bound : coût partiel déjà supérieur ou égal au meilleur
        }
        for (var i = 0; i < reste.length; i++) permuter(reste.slice(0, i).concat(reste.slice(i + 1)), pris.concat([reste[i]]));
      })(groupes, []);
    } else {
      // Plus proche voisin sensible aux zones et fenêtres horaires, puis 2-opt + Or-opt
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
      for (var tour = 0, ameliore = true; ameliore && tour < 25; tour++) {
        ameliore = false;
        // 2-opt : inversion de segments
        for (var i = 0; i < ordre.length - 1; i++) {
          for (var j = i + 1; j < ordre.length; j++) {
            var essai = ordre.slice(0, i).concat(ordre.slice(i, j + 1).reverse(), ordre.slice(j + 1));
            var avant = best.c.cout; evaluer(essai);
            if (best.c.cout < avant - 1e-6) { ordre = essai; ameliore = true; }
          }
        }
        // Or-opt : déplacement d'un bloc (ou paire) vers une autre position (idéal avec fenêtres horaires)
        for (var len = 1; len <= 2; len++) {
          for (var a = 0; a + len <= ordre.length; a++) {
            var seg = ordre.slice(a, a + len), sans = ordre.slice(0, a).concat(ordre.slice(a + len));
            for (var p = 0; p <= sans.length; p++) {
              if (p === a) continue;
              var essai2 = sans.slice(0, p).concat(seg, sans.slice(p));
              var avant2 = best.c.cout; evaluer(essai2);
              if (best.c.cout < avant2 - 1e-6) { ordre = essai2; ameliore = true; }
            }
          }
        }
      }
    }
    return best ? best.r : libres;
  }
  // Ordre retenu : le regroupement par établissement, sauf s'il crée plus de retards que l'ordre d'origine
  function meilleurOrdre(route, depart) {
    if (route.length < 2) return route;
    var nouveau = ordonnerItems(route, depart);
    return coutOrdre(nouveau, depart).cout <= coutOrdre(route, depart).cout ? nouveau : route;
  }

  // Ordonne une liste d'arrêts d'une même journée (après ajout, retrait, nouveau tirage)
  // 3.27.13 : apres (minutes) : aujourd'hui, aucune visite à faire n'est proposée avant l'heure actuelle
  // 3.29.0 : évaluation rapide d'un ajout : l'ordre actuel de la journée est gardé, le nouvel arrêt est inséré à la meilleure place
  // (sans recalculer tous les ordres possibles). Renvoie { heure, retards, km } : km = détour ajouté par l'arrêt
  function evaluerInsertion(arrets, nouvel, depart) {
    var route = arrets.slice().sort(function (x, y) { return (heureVersMinutes(x.heure) || 0) - (heureVersMinutes(y.heure) || 0); }).map(item);
    var dep = depart ? { coord: depart } : null, it = item(nouvel), avant = simuler(route), best = null;
    for (var i = 0; i <= route.length; i++) {
      var essai = route.slice(0, i).concat([it], route.slice(i)), s = simuler(essai), d = delta(route, i, it, dep);
      var cout = (s.nbRetards - avant.nbRetards) * 1000 + d;
      if (!best || cout < best.cout) best = { cout: cout, heure: minutesVersHeure(s.debuts[i]), retards: s.nbRetards, base: avant.nbRetards, km: d };
    }
    return best;
  }
  function ordonnerJour(arrets, depart, apres) {
    var its = arrets.map(item);
    if (apres) its.forEach(function (it) { if (!it.fixe && !it.a.rdv && !it.a.statut) it.tot = Math.max(it.tot, apres); });
    its.sort(function (a, b) { return a.tot - b.tot || a.tard - b.tard; });
    var route = [], dep = depart ? { coord: depart } : null;
    its.forEach(function (it) { route = insererAuMieux(route, it, dep); });
    return finaliser(meilleurOrdre(route, dep));
  }

  // 3.28.20 : regroupement : les médecins d'un même hôpital se suivent, et les hôpitaux d'un même quartier aussi,
  // tant que cela ne crée aucun retard et ne finit pas la journée plus de 20 min plus tard
  function cleNorm(x) { return String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''); }
  function cleEtablissement(it) { var a = it.a; return cleNorm(a.lieu) ? cleNorm(a.lieu) + '|' + cleNorm(a.commune) : 'u|' + (a.uid || a.code); }
  // 3.28.26 : dans un même hôpital, les médecins d'une même spécialité se suivent
  function cleLieuSpec(it) { return cleEtablissement(it) + '|' + cleNorm(it.a.specialite || it.a.type); }
  // 3.28.22 : quartier ramené à son nom principal : « Anador », « Abobo Anador » et « Anador Sogefiha » vont ensemble ;
  // le nom de la commune n'est retiré que s'il est un mot séparé (« Aboboté » reste « Aboboté »)
  function cleSecteur(quartier, commune) {
    var mots = String(quartier || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
    var com = String(commune || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
    var vides = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, quartier: 1, cite: 1, zone: 1, sous: 1, prefecture: 1 };
    var reste = mots.filter(function (w) { return com.indexOf(w) < 0 && !vides[w] && w.length >= 3; });
    if (!reste.length) return mots.join('');   // « Cocody Centre », « Plateau » : le nom entier
    return reste[0] === 'centre' ? mots.join('') : reste[0];
  }
  function cleQuartier(it) { var a = it.a, k = cleSecteur(a.quartier, a.commune); return k ? k + '|' + cleNorm(a.commune) : cleEtablissement(it); }
  // 3.28.23 : secteur de la tournée : sous-secteur des grandes communes (« Abobo – Nord & PK18 »), sinon la commune
  function nomSecteurTournee(a) {
    var z = typeof zoneDeQuartier === 'function' ? zoneDeQuartier(a.commune, a.quartier, a.lieu) : '';
    return z || a.commune || a.quartier || '';
  }
  function cleSecteurTournee(it) { var k = cleNorm(nomSecteurTournee(it.a)); return k || cleQuartier(it); }
  function regrouper(route) {
    if (route.length < 3 || route.some(function (it) { return it.fixe; })) return route;   // visites déjà faites : ordre réel gardé
    var ref = simuler(route), finRef = ref.debuts.length ? Math.max.apply(null, ref.debuts) : 0;
    function acceptable(r) {
      var s = simuler(r);
      return s.nbRetards <= ref.nbRetards && (s.debuts.length ? Math.max.apply(null, s.debuts) : 0) <= finRef + 20;
    }
    function grouperPar(r, cle) {   // ordre des groupes = ordre de leur première visite
      var ordre = [], par = {};
      r.forEach(function (it) { var k = cle(it); if (!par[k]) { par[k] = []; ordre.push(k); } par[k].push(it); });
      return ordre.reduce(function (l, k) { return l.concat(par[k]); }, []);
    }
    // 1. d'un coup, si possible
    var r0 = grouperPar(route, cleLieuSpec), r1 = grouperPar(r0, cleEtablissement), r2 = grouperPar(r1, cleQuartier), r3 = grouperPar(r2, cleSecteurTournee);
    if (acceptable(r3)) return r3;
    var r = acceptable(r2) ? r2 : (acceptable(r1) ? r1 : (acceptable(r0) ? r0 : route.slice()));
    // 2. sinon, visite par visite : rapprochée de la dernière visite du même hôpital (puis du même quartier) si l'horaire le permet
    [cleLieuSpec, cleEtablissement, cleQuartier, cleSecteurTournee].forEach(function (cle) {
      for (var passe = 0; passe < 2; passe++) {
        for (var i = 1; i < r.length; i++) {
          var k = cle(r[i]);
          if (cle(r[i - 1]) === k) continue;
          var j = -1;
          for (var x = i - 2; x >= 0; x--) if (cle(r[x]) === k) { j = x; break; }
          if (j < 0) continue;
          var essai = r.slice(0, i).concat(r.slice(i + 1));
          essai.splice(j + 1, 0, r[i]);
          if (acceptable(essai)) r = essai;
        }
      }
    });
    return r;
  }

  function finaliser(route) {
    route = regrouper(route);
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
  // Candidats éligibles pour une date donnée (réutilisé par genererPlanning pour estimer la charge)
  function candidatsJour(ctx, date, o, utilises) {
    var j = jourSemaineIndex(date);
    if (j > 4 || (ctx.feries && ctx.feries[date])) return [];
    var dans = null;
    if (o.communes && o.communes.length) { dans = {}; o.communes.forEach(function (c) { dans[c] = true; }); }
    var out = [];
    ctx.parJour[j].forEach(function (c) {
      if (utilises && utilises[c.code]) return;
      if (o.exclus && o.exclus[c.code]) return;
      if (dans && !(typeof communeCorrespondante === 'function' ? communeCorrespondante(c, dans) : dans[c.commune])) return;
      if (o.accepte && !o.accepte(c.prat)) return;
      if (absentLe(c.prat, date)) return;
      if (joursEcoules(c.prat.derniere, date) < (o.delai || 0)) return;
      out.push(c);
    });
    return out;
  }

  // Rééquilibrage post-sélection : si un praticien « Matin et soir » a été affecté au créneau surchargé,
  // on bascule son créneau vers la demi-journée sous-chargée si ses horaires et la route restent sans retard.
  function equilibrerCreneaux(route, cands, depart, targetMatin, targetSoir) {
    for (var step = 0; step < route.length; step++) {
      var curM = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
      var curS = route.length - curM;
      var sur = curM > targetMatin + (curS < targetSoir ? 0 : 1) ? 'Matin' : (curS > targetSoir + (curM < targetMatin ? 0 : 1) ? 'Soir' : '');
      if (!sur) break;
      var cibleCren = sur === 'Matin' ? 'Soir' : 'Matin';
      var refCost = coutOrdre(route, depart);
      var meilleur = null;
      for (var i = 0; i < route.length; i++) {
        var it = route[i], a = it.a;
        if (it.fixe || a.impose || a.garde || a.rdv || a.statut || a.etat === 'valide' || creneauDeItem(it) !== sur) continue;
        var alt = cands.filter(function (cd) { return cd.a.code === a.code && cd.a.creneau === cibleCren; })
          .sort(function (x, y) { return (x.a.idPresence === a.idPresence ? 0 : 1) - (y.a.idPresence === a.idPresence ? 0 : 1); })[0];
        if (!alt) continue;
        var essai = route.slice();
        essai[i] = alt.it;
        essai = meilleurOrdre(essai, depart);
        var c = coutOrdre(essai, depart);
        if (c.retards <= refCost.retards && c.cout <= refCost.cout + 6) {
          if (!meilleur || c.cout < meilleur.cost) meilleur = { route: essai, cost: c.cout };
        }
      }
      if (!meilleur) break;
      route = meilleur.route;
    }
    return route;
  }

  // o : { communes: [..] | null, maxJour, targetJour, delai, exclus, rejetes, autreDispos, fixes: [arrêts], depart }
  function planifierJour(ctx, date, o, utilises) {
    var j = jourSemaineIndex(date);
    var depart = o.depart ? { coord: o.depart } : null;
    var route = [];
    (o.fixes || []).slice().sort(function (a, b) { return item(a).tot - item(b).tot; })
      .forEach(function (a) { route = insererAuMieux(route, item(a), depart); });
    if (j > 4 || (ctx.feries && ctx.feries[date])) return finaliser(route);

    var creneaux = candidatsJour(ctx, date, o, utilises);
    var cands = creneaux.map(function (c) {
      var a = arretDepuisCreneau(c, date);
      return { a: a, it: item(a), score: a.score * (0.5 + 0.5 * a.fiab), rejete: !!(o.rejetes && o.rejetes[c.code]) };
    });

    // Densité géographique autour de chaque candidat pour éviter d'ancrer la journée sur un point isolé
    var densite = {};
    cands.forEach(function (cd) {
      if (densite[cd.a.code] !== undefined) return;
      var vus = {}, n = 0;
      cands.forEach(function (autre) {
        if (autre.a.code !== cd.a.code && !vus[autre.a.code] && dist(cd.it, autre.it) <= 2.5) { vus[autre.a.code] = true; n++; }
      });
      densite[cd.a.code] = Math.min(6, n) * 8;
    });

    var max = o.maxJour || 8;
    var cibleJour = Math.min(max, Math.max(route.length, o.targetJour || max));
    var targetMatin = Math.ceil(cibleJour / 2), targetSoir = cibleJour - targetMatin;

    function passe(avecRejetes) {
      while (route.length < cibleJour) {
        var dansRoute = {}, routeQ = {}, routeZ = {};
        route.forEach(function (it) {
          dansRoute[it.a.code] = true;
          routeQ[cleQuartier(it)] = true;
          routeZ[cleSecteurTournee(it)] = true;
        });
        var curMatin = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
        var curSoir = route.length - curMatin;
        var base = simuler(route).nbRetards, options = [];
        cands.forEach(function (cd) {
          if (dansRoute[cd.a.code] || (cd.rejete && !avecRejetes)) return;
          var cren = creneauDeItem(cd.it);
          var bonusEquilibre = 0;
          if (cren === 'Matin') {
            if (curMatin < targetMatin) bonusEquilibre = (curSoir >= targetSoir) ? 120 : (curSoir > curMatin ? 65 : 25);
            else if (curSoir < targetSoir) bonusEquilibre = -160;
          } else {
            if (curSoir < targetSoir) bonusEquilibre = (curMatin >= targetMatin) ? 120 : (curMatin > curSoir ? 65 : 25);
            else if (curMatin < targetMatin) bonusEquilibre = -160;
          }
          // Cohésion de zone : on complète les quartiers/secteurs déjà entamés plutôt que de faire des allers-retours
          var bonusZone = route.length
            ? (routeQ[cleQuartier(cd.it)] ? 45 : (routeZ[cleSecteurTournee(cd.it)] ? 25 : 0))
            : (densite[cd.a.code] || 0);
          var penRarete = o.autreDispos ? -12 * (o.autreDispos[cd.a.code] || 0) : 0;
          for (var i = 0; i <= route.length; i++) {
            var v = cd.score + bonusEquilibre + bonusZone + penRarete - R.penaliteKm * delta(route, i, cd.it, depart);
            options.push({ v: v, cd: cd, i: i });
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
    if (route.length < cibleJour) passe(true);
    route = equilibrerCreneaux(meilleurOrdre(route, depart), cands, depart, targetMatin, targetSoir);
    route.forEach(function (it) { utilises[it.a.code] = true; });
    return finaliser(route);
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

    // 3.28.17 : un lieu hors des communes choisies pour ce jour n'est pris que pour un RDV ou prioritaire choisi à la main
    function dansCommunes(c, d) {
      var l = p.communesPour ? p.communesPour(d) : null;
      if (!l || !l.length) return true;
      var dans = {}; l.forEach(function (x) { dans[x] = true; });
      return typeof communeCorrespondante === 'function' ? communeCorrespondante(c, dans) : !!dans[c.commune];
    }
    (p.imposes || []).forEach(function (im) {
      if (utilises[im.code]) return;
      var rdv = heureVersMinutes(im.rdv), options = [], horsZone = 0;
      p.dates.forEach(function (d) {
        var j = jourSemaineIndex(d);
        if (j > 4 || (im.date && im.date !== d) || (im.apres && d < im.apres) || (ctx.feries && ctx.feries[d])) return;
        (ctx.parCode[im.code] || []).forEach(function (c) {
          if (c.jourIdx !== j || (im.cle && im.cle !== c.cle)) return;
          var ok = dansCommunes(c, d);
          if (!ok) horsZone++;
          // RDV repris de l'historique (étape) : jamais hors des communes du jour
          if (ok || !im.etape) options.push({ d: d, c: c, hors: ok ? 0 : 1 });
        });
      });
      if (!options.length) { if (horsZone) im.horsCommunes = true; nonPlaces.push(im); return; }
      options.sort(function (x, y) {
        var cx = rdv !== null && x.c.debut <= rdv && rdv <= x.c.fin ? 0 : 1;
        var cy = rdv !== null && y.c.debut <= rdv && rdv <= y.c.fin ? 0 : 1;
        return x.hors - y.hors || cx - cy || fixes[x.d].length - fixes[y.d].length || (x.d < y.d ? -1 : x.d > y.d ? 1 : 0) || x.c.debut - y.c.debut;
      });
      var o = options[0], a = arretDepuisCreneau(o.c, o.d);
      a.impose = true; a.garde = true; if (im.etape) { a.etape = true; a.rdvDate = im.dateRdv || im.apres || ''; a.rdvPrisLe = im.prisLe || ''; }
      if (rdv !== null) a.rdv = minutesVersHeure(rdv);
      fixes[o.d].push(a);
      utilises[im.code] = true;
    });

    // Répartition équilibrée de la charge sur l'ensemble des jours ouvrés de la période
    var maxJ = p.maxJour || 8;
    var ouverts = p.dates.filter(function (d) { return jourSemaineIndex(d) <= 4 && !(ctx.feries && ctx.feries[d]); });
    var codesParJour = {}, poolUnique = {}, nbDisposCode = {};
    ouverts.forEach(function (d) {
      var opts = { communes: p.communesPour ? p.communesPour(d) : null, delai: p.delai, exclus: p.exclus, accepte: p.accepte };
      var cs = candidatsJour(ctx, d, opts, utilises);
      var vus = {};
      cs.forEach(function (c) { vus[c.code] = true; poolUnique[c.code] = true; });
      codesParJour[d] = Object.keys(vus);
      codesParJour[d].forEach(function (code) { nbDisposCode[code] = (nbDisposCode[code] || 0) + 1; });
    });

    var totalFix = 0;
    ouverts.forEach(function (d) { totalFix += (fixes[d] || []).length; });
    var ciblesJour = {};
    if (ouverts.length > 1) {
      var capJour = {};
      ouverts.forEach(function (d) { capJour[d] = Math.min(maxJ, fixes[d].length + codesParJour[d].length); ciblesJour[d] = fixes[d].length; });
      var poolTotal = Math.min(ouverts.length * maxJ, Object.keys(poolUnique).length + totalFix);
      var aRepartir = Math.max(0, poolTotal - totalFix), actifs = ouverts.slice();
      // Distribution équilibrée par paliers (water-filling) respectant la capacité de chaque jour
      while (aRepartir > 0 && actifs.length) {
        var suivants = [], progres = false;
        actifs.forEach(function (d) {
          if (aRepartir > 0 && ciblesJour[d] < capJour[d]) {
            ciblesJour[d]++; aRepartir--; progres = true;
            if (ciblesJour[d] < capJour[d]) suivants.push(d);
          }
        });
        if (!progres) break;
        actifs = suivants;
      }
    } else {
      ouverts.forEach(function (d) { ciblesJour[d] = maxJ; });
    }

    // Ordre MRV : les jours ayant le moins de praticiens disponibles sont planifiés en premier
    var ordreJours = p.dates.slice().sort(function (a, b) {
      var na = codesParJour[a] ? codesParJour[a].length : 9999;
      var nb = codesParJour[b] ? codesParJour[b].length : 9999;
      return na - nb || (a < b ? -1 : a > b ? 1 : 0);
    });

    var parDate = {};
    ordreJours.forEach(function (d) {
      var autreDispos = {};
      if (codesParJour[d]) {
        codesParJour[d].forEach(function (code) {
          autreDispos[code] = Math.max(0, (nbDisposCode[code] || 1) - 1);
        });
      }
      parDate[d] = planifierJour(ctx, d, {
        communes: p.communesPour ? p.communesPour(d) : null, maxJour: maxJ, targetJour: ciblesJour[d] || maxJ,
        delai: p.delai, exclus: p.exclus, rejetes: p.rejetes, autreDispos: autreDispos,
        fixes: fixes[d], depart: p.depart, accepte: p.accepte
      }, utilises);
      // Décrémente les disponibilités restantes pour les jours pas encore traités
      if (codesParJour[d]) {
        codesParJour[d].forEach(function (code) { if (nbDisposCode[code]) nbDisposCode[code]--; });
      }
    });

    var arrets = [];
    p.dates.forEach(function (d) { arrets = arrets.concat(parDate[d] || []); });
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
      var d = distanceVol(pos, c.coord);   // 3.25.9 : vol d'oiseau depuis le téléphone
      // 3.25.10 : lieu sans GPS (centre du quartier) : retenu s'il peut être dans le rayon (marge de 1 km)
      if ((c.coord && c.coord.approx ? Math.max(0, d - 1) : d) > rayon) return;
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
      // 3.25.8 : du plus proche au plus loin (présents d'abord, puis plus tard dans la journée)
      return a.ordre - b.ordre || a.dist - b.dist || b.score - a.score;
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
    var communes = {}, ordreZones = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest', 'Zone Intérieur'];
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
    // ancien libellé (historique antérieur à la conversion de la base)
    if (STATUTS_RENOMMES[statut]) return estVisite(STATUTS_RENOMMES[statut], statuts);
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
      // seul un RDV confirmé reste comme prochaine étape (placée d'office dans la tournée) ; un rappel ne l'est pas
      p.prochaine = v.rdv === false ? '' : (v.prochaine || '');
      p.statut = v.statut;
      p.commentaire = v.commentaire || '';
    });
  }

  return {
    preparer: preparer, creneauParCle: creneauParCle, arretDepuisCreneau: arretDepuisCreneau, scoreDe: scoreDe,
    simuler: simuler, ordonnerJour: ordonnerJour, planifierJour: planifierJour, genererPlanning: genererPlanning,
    autourDe: autourDe, quartierLePlusProche: quartierLePlusProche, couverture: couverture, cleSecteur: cleSecteur, nomSecteurTournee: nomSecteurTournee,
    estVisite: estVisite, appliquerVisite: appliquerVisite, item: item, uid: uid, evaluerInsertion: evaluerInsertion
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
