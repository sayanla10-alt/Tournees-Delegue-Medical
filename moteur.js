/* =============================================================================
   moteur.js : planification, ordre de tournée, rattrapage, validation locale
   Tourne entièrement sur le téléphone (fonctionne hors ligne).
   Dépend de commun.js.
   ============================================================================= */

var Moteur = (function () {

  function indexQuartiers(quartiers) {
    var m = {};
    (quartiers || []).forEach(function (q) { m[String(q.quartier).toLowerCase()] = q; });
    return m;
  }

  function distQ(idx, q1, q2) {
    var a = String(q1 || '').toLowerCase(), b = String(q2 || '').toLowerCase();
    if (a && a === b) return 0;
    return distanceKm(idx[a], idx[b]);
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // Transforme une ligne de la base en arrêt de tournée
  function creerArret(row, date, score, dist) {
    return {
      uid: uid(), date: date, jour: row.jour, creneau: row.creneau, heure: row.heure || '',
      rowId: row.id, code: row.code, nom: row.nom, type: row.type, specialite: row.specialite,
      priorite: +row.priorite || 3, commune: row.commune, quartier: row.quartier, lieu: row.lieu,
      derniere: row.derniere || '', joursEcoules: joursEcoules(row.derniere, date),
      score: score, dist: Math.round(dist * 10) / 10,
      statut: '', commentaire: '', etat: ''
    };
  }

  // ------------------------------------------------------------------ Planning
  // p : { mode: 'jour'|'semaine', dateRef, commune, maxJour, regroup, delai, exclusCodes: {} }
  function genererPlanning(base, quartiers, p) {
    var idx = indexQuartiers(quartiers);
    var dates = [];
    if (p.mode === 'jour') {
      if (jourSemaineIndex(p.dateRef) < 5) dates.push(p.dateRef);
    } else {
      var lundi = lundiDe(p.dateRef);
      for (var d = 0; d < 5; d++) dates.push(ajouterJours(lundi, d));
    }
    var dejaSemaine = {};
    Object.keys(p.exclusCodes || {}).forEach(function (c) { dejaSemaine[c] = true; });
    var plan = [];
    dates.forEach(function (date) {
      plan = plan.concat(planifierJour(base, idx, date, p, dejaSemaine));
    });
    return plan;
  }

  function planifierJour(base, idx, date, p, dejaSemaine) {
    var jour = nomJour(date);
    var commune = p.commune || 'Toutes';
    var cand = [];

    // 1. Candidats présents ce jour, dans la commune filtrée, non vus récemment
    base.forEach(function (row) {
      if (row.jour !== jour) return;
      if (commune !== 'Toutes' && row.commune !== commune) return;
      if (dejaSemaine[row.code]) return;
      var je = joursEcoules(row.derniere, date);
      if (je < (p.delai || 0)) return;
      var sc = calcScore(row.priorite, je, row.statut);
      cand.push({ row: row, score: sc, adj: sc });
    });
    if (!cand.length) return [];

    // 2. Regroupement : pénalité selon la distance à la cible au meilleur score
    if (p.regroup !== false) {
      var ancre = cand.reduce(function (a, b) { return b.score > a.score ? b : a; });
      cand.forEach(function (c) {
        c.adj = c.score - REGLAGES_MOTEUR.penaliteKm * distQ(idx, ancre.row.quartier, c.row.quartier);
      });
    }

    // 3. Sélection des meilleures cibles, un seul passage par praticien
    cand.sort(function (a, b) { return b.adj - a.adj; });
    var sel = [], vus = {};
    for (var i = 0; i < cand.length && sel.length < (p.maxJour || 8); i++) {
      if (vus[cand[i].row.code]) continue;
      vus[cand[i].row.code] = true;
      dejaSemaine[cand[i].row.code] = true;
      sel.push(cand[i]);
    }

    // 4. Ordre de tournée : matin puis après-midi
    var matin = sel.filter(function (c) { return c.row.creneau === 'Matin'; });
    var apm = sel.filter(function (c) { return c.row.creneau !== 'Matin'; });
    var etat = { qPrev: '' };
    return ordonner(matin, idx, date, etat).concat(ordonner(apm, idx, date, etat));
  }

  // Ordre de tournée par simulation d'horloge : l'heure indiquée est l'heure à partir
  // de laquelle le praticien est présent. À chaque étape, on choisit l'arrêt qui permet
  // de commencer la visite le plus tôt (trajet + attente), à égalité le plus proche.
  function ordonner(liste, idx, date, etat) {
    var R = REGLAGES_MOTEUR, reste = liste.slice(), res = [];
    if (!reste.length) return res;
    var matin = reste[0].row.creneau === 'Matin';
    var fin = matin ? R.finMatin : R.finApresMidi;
    var horloge = null;
    while (reste.length) {
      var best = -1, bestDebut = Infinity, bestTrajet = Infinity;
      for (var k = 0; k < reste.length; k++) {
        var h = heureVersMinutes(reste[k].row.heure);
        if (h === null) h = matin ? 8 * 60 : 14 * 60;
        var trajet = etat.qPrev ? distQ(idx, etat.qPrev, reste[k].row.quartier) * R.minutesParKm : 0;
        var debut = horloge === null ? h : Math.max(horloge + trajet, h);
        if (debut < bestDebut - 1 || (Math.abs(debut - bestDebut) <= 1 && trajet < bestTrajet)) {
          best = k; bestDebut = debut; bestTrajet = trajet;
        }
      }
      var c = reste.splice(best, 1)[0];
      var dist = etat.qPrev ? distQ(idx, etat.qPrev, c.row.quartier) : 0;
      var a = creerArret(c.row, date, c.score, dist);
      a.heurePrevue = minutesVersHeure(bestDebut);
      a.horsCreneau = bestDebut > fin;
      res.push(a);
      etat.qPrev = c.row.quartier;
      horloge = bestDebut + R.dureeVisite;
    }
    return res;
  }

  function minutesVersHeure(m) {
    m = Math.round(m);
    return pad2(Math.floor(m / 60) % 24) + ':' + pad2(m % 60);
  }

  // Insère un arrêt dans le plan, à sa place selon la date, le créneau et l'heure,
  // puis recalcule les distances entre arrêts du jour
  function insererArret(plan, arret, quartiers) {
    var cle = function (a) {
      var h = heureVersMinutes(a.heure);
      return a.date + (a.creneau === 'Matin' ? '0' : '1') + ('000' + (h === null ? 720 : h)).slice(-4);
    };
    var k = cle(arret), pos = plan.length;
    for (var i = 0; i < plan.length; i++) {
      if (plan[i].date === arret.date && cle(plan[i]) > k) { pos = i; break; }
      if (plan[i].date > arret.date) { pos = i; break; }
    }
    plan.splice(pos, 0, arret);
    recalculerDistances(plan, quartiers);
    return plan;
  }

  function recalculerDistances(plan, quartiers) {
    var idx = indexQuartiers(quartiers), prev = null;
    plan.forEach(function (a) {
      if (!prev || prev.date !== a.date) a.dist = 0;
      else a.dist = Math.round(distQ(idx, prev.quartier, a.quartier) * 10) / 10;
      prev = a;
    });
  }

  // ------------------------------------------------------------------ Rattrapage
  // ref : { quartier, date, creneau, heure ('HH:MM' ou ''), code, rowId }
  function proposerRattrapage(base, quartiers, plan, ref, delai) {
    var idx = indexQuartiers(quartiers);
    var jour = nomJour(ref.date);
    var hRef = heureVersMinutes(ref.heure);
    var exclus = {};
    (plan || []).forEach(function (a) { if (a.date === ref.date) exclus[a.code] = true; });
    if (ref.code) exclus[ref.code] = true;

    // A. Même praticien : autres lieux ou créneaux, et même créneau la semaine suivante
    var meme = [];
    if (ref.code) {
      base.forEach(function (row) {
        if (row.code !== ref.code) return;
        var date, source;
        if (String(row.id) === String(ref.rowId)) {
          date = ajouterJours(ref.date, 7); source = 'Même lieu, semaine suivante';
        } else {
          var strict = !(row.jour === jour && ref.creneau === 'Matin' && row.creneau !== 'Matin');
          date = prochaineDate(ref.date, row.jour, strict); source = 'Autre lieu du praticien';
        }
        meme.push({
          row: row, date: date, source: source, dist: distQ(idx, ref.quartier, row.quartier),
          score: calcScore(row.priorite, joursEcoules(row.derniere, date), row.statut)
        });
      });
      meme.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    }

    // B. Cibles disponibles le même jour, à proximité
    var proches = [];
    base.forEach(function (row) {
      if (row.jour !== jour || exclus[row.code]) return;
      if (ref.creneau !== 'Matin' && row.creneau === 'Matin') return;
      var h = heureVersMinutes(row.heure);
      if (hRef !== null && h !== null && h < hRef - 60) return;
      var je = joursEcoules(row.derniere, ref.date);
      if (je < (delai || 0)) return;
      var d = distQ(idx, ref.quartier, row.quartier);
      if (d > REGLAGES_MOTEUR.rayonRattrapageKm) return;
      var sc = calcScore(row.priorite, je, row.statut);
      proches.push({ row: row, date: ref.date, dist: d, score: sc,
                     source: d === 0 ? 'Même quartier' : 'À proximité',
                     cle: Math.floor(d / 1.5) * 1000 - sc });
    });
    proches.sort(function (a, b) { return a.cle - b.cle; });
    var vus = {}, top = [];
    for (var i = 0; i < proches.length && top.length < REGLAGES_MOTEUR.nbPropositions; i++) {
      if (vus[proches[i].row.code]) continue;
      vus[proches[i].row.code] = true;
      top.push(proches[i]);
    }
    return { memePraticien: meme, proches: top };
  }

  // Quartier le plus proche d'une position GPS
  function quartierLePlusProche(lat, lon, quartiers) {
    var best = null, bestD = Infinity, p = { lat: lat, lon: lon };
    (quartiers || []).forEach(function (q) {
      var d = distanceKm(p, q) / REGLAGES_MOTEUR.detourRoutier;
      if (d < bestD) { bestD = d; best = q; }
    });
    return best ? { quartier: best, km: bestD } : null;
  }

  // ------------------------------------------------------------------ Validation locale
  function estVisite(statut, statuts) {
    var s = (statuts && statuts.length ? statuts : STATUTS_DEFAUT);
    for (var i = 0; i < s.length; i++) if (s[i].nom === statut) return !!s[i].visite;
    return false;
  }

  // Applique une visite validée à toutes les lignes du même praticien
  function appliquerVisite(base, v, statuts) {
    var compte = estVisite(v.statut, statuts);
    base.forEach(function (row) {
      if (row.code !== v.code) return;
      if (compte) {
        if (!row.derniere || v.date > row.derniere) row.derniere = v.date;
        row.nbVisites = (+row.nbVisites || 0) + 1;
      }
      row.statut = v.statut;
      row.commentaire = v.commentaire || '';
    });
  }

  return {
    genererPlanning: genererPlanning, insererArret: insererArret, creerArret: creerArret,
    recalculerDistances: recalculerDistances, proposerRattrapage: proposerRattrapage,
    quartierLePlusProche: quartierLePlusProche, estVisite: estVisite,
    appliquerVisite: appliquerVisite, indexQuartiers: indexQuartiers, distQ: distQ
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
