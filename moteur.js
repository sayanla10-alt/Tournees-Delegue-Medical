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
  function coordObj(o) {
    if (!o || o.lat === null || o.lat === undefined || o.lat === '' || o.lon === null || o.lon === undefined || o.lon === '') return null;
    var la = +o.lat, lo = +o.lon;
    return isFinite(la) && isFinite(lo) ? { lat: la, lon: lo } : null;
  }
  function refCompatibleCommune(commune, ref) {
    var c = cleNorm(commune);
    if (!c || c === 'abidjan') return true;
    if (ref && ref.commune) {
      var c1 = cleNorm(typeof communeParente === 'function' ? communeParente(commune) : commune);
      var c2 = cleNorm(typeof communeParente === 'function' ? communeParente(ref.commune) : ref.commune);
      return c1 === c2;
    }
    if (typeof estCommuneInterieur === 'function') return !estCommuneInterieur(commune);
    return typeof estCommuneGrandAbidjan === 'function' ? estCommuneGrandAbidjan(commune) : true;
  }

  // ------------------------------------------------------------------ Contexte
  // data : { praticiens, presences, quartiers }
  function preparer(data) {
    var idxQ = {}, ambiguQ = {}, parQ = {}, parAmbiguQ = {};
    var normIdxQ = {}, normAmbiguQ = {}, normParQ = {}, normParAmbiguQ = {};
    function extraireVariantes(v) {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      return String(v).split(/[;,|\n]+/);
    }
    function ajouterIndexQ(q, nom, prioritaire) {
      var k = bas(nom);
      if (!k) return;
      var kc = bas(q.commune), ks = bas(q.subdivision);
      var kp = typeof communeParente === 'function' ? bas(communeParente(q.commune)) : kc;
      if (kc) {
        var ck = kc + '|' + k;
        if (prioritaire || !idxQ[ck]) idxQ[ck] = q;
      }
      if (ks && ks !== kc) {
        var sk = ks + '|' + k;
        if (prioritaire || !idxQ[sk]) idxQ[sk] = q;
      }
      if (kp && kp !== kc) {
        var kpk = kp + '|' + k;
        if (!parAmbiguQ[kpk]) {
          if (parQ[kpk] && parQ[kpk] !== q) { delete parQ[kpk]; parAmbiguQ[kpk] = true; }
          else if (prioritaire || !parQ[kpk]) parQ[kpk] = q;
        }
      }
      if (!ambiguQ[k]) {
        if (idxQ[k] && idxQ[k] !== q) {
          delete idxQ[k];
          ambiguQ[k] = true;
        } else {
          idxQ[k] = q;
        }
      }
      var nk = cleNorm(nom), nkc = cleNorm(q.commune), nks = cleNorm(q.subdivision);
      var nkp = typeof communeParente === 'function' ? cleNorm(communeParente(q.commune)) : nkc;
      if (!nk) return;
      if (nkc) {
        var nck = nkc + '|' + nk;
        if (prioritaire || !normIdxQ[nck]) normIdxQ[nck] = q;
      }
      if (nks && nks !== nkc) {
        var nsk = nks + '|' + nk;
        if (prioritaire || !normIdxQ[nsk]) normIdxQ[nsk] = q;
      }
      if (nkp && nkp !== nkc) {
        var nkpk = nkp + '|' + nk;
        if (!normParAmbiguQ[nkpk]) {
          if (normParQ[nkpk] && normParQ[nkpk] !== q) { delete normParQ[nkpk]; normParAmbiguQ[nkpk] = true; }
          else if (prioritaire || !normParQ[nkpk]) normParQ[nkpk] = q;
        }
      }
      if (!normAmbiguQ[nk]) {
        if (normIdxQ[nk] && normIdxQ[nk] !== q) {
          delete normIdxQ[nk];
          normAmbiguQ[nk] = true;
        } else {
          normIdxQ[nk] = q;
        }
      }
    }
    (data.quartiers || []).forEach(function (q) {
      if (!q) return;
      ajouterIndexQ(q, q.quartier, true);
      if (q.secteur) ajouterIndexQ(q, q.secteur, false);
      extraireVariantes(q.variantes).forEach(function (v) { ajouterIndexQ(q, v, false); });
    });
    var prat = {};
    (data.praticiens || []).forEach(function (p) {
      if (!p.code || inactif(p)) return;
      var pc = Object.assign({}, p);
      pc.note = lireNote(pc.note);
      if (pc.type !== 'Pharmacie' && typeof specialiteCanonique === 'function') pc.specialite = specialiteCanonique(pc.specialite);
      pc.conv = estConventionne(pc.conventionne);
      prat[pc.code] = pc;
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
    var etabCoords = {}, immeubles = {}, etabParCle = {}, etabParNom = {};
    (data.etablissements || []).forEach(function (e) {
      var ke = cleNorm(e.nom || '') + '|' + cleNorm(e.commune || '');
      var kn = cleNorm(e.nom || '');
      var co = lireCoord(e);
      if (ke && co) {
        var refE = typeof trouverEtablissementRef === 'function' ? trouverEtablissementRef(e.nom) : null;
        var refEC = coordObj(refE);
        if (refEC && refCompatibleCommune(e.commune, refE) && distanceVol(co, refEC) > 1.5) co = refEC;
        etabCoords[ke] = co;
      }
      if (ke) {
        var immE = {
          cle: ke, nom: e.nom || '', territoire: e.territoire || '', zone: e.zone || '',
          commune: e.commune || '', subdivision: e.subdivision || '',
          quartier: e.quartier || '', secteur: e.secteur || '', coord: co || null
        };
        etabParCle[ke] = immE;
        immeubles[ke] = immE;
        if (kn) etabParNom[kn] = (etabParNom[kn] === undefined) ? immE : false;
      }
    });
    var idsVus = {};
    (data.presences || []).forEach(function (pr, i) {
      // 3.26.50 : identifiant en double (base corrigée à la main) : rendu unique, sinon deux lieux s'échangent à l'écran
      var origId = pr.id;
      var prId = (origId === undefined || origId === '' || idsVus[String(origId)]) ? ('L' + (i + 2) + '-' + pr.code) : origId;
      idsVus[String(prId)] = true;
      var p = prat[pr.code];
      if (!p) return;
      var prCopy = Object.assign({}, pr, { id: prId });
      (presencesParCode[pr.code] = presencesParCode[pr.code] || []).push(prCopy);
      var kc = bas(pr.commune), kp = typeof communeParente === 'function' ? bas(communeParente(pr.commune)) : kc;
      var nkc = cleNorm(pr.commune), nkp = typeof communeParente === 'function' ? cleNorm(communeParente(pr.commune)) : nkc;
      function chercherQ(nom) {
        var k = bas(nom);
        if (k) {
          var trouve = (kc && idxQ[kc + '|' + k]) ||
            (kp && (idxQ[kp + '|' + k] || parQ[kp + '|' + k])) ||
            ((!kc || kc === 'abidjan') ? idxQ[k] : null);
          if (trouve) return trouve;
        }
        var nk = cleNorm(nom);
        if (!nk) return null;
        return (nkc && normIdxQ[nkc + '|' + nk]) ||
          (nkp && (normIdxQ[nkp + '|' + nk] || normParQ[nkp + '|' + nk])) ||
          ((!nkc || nkc === 'abidjan') ? normIdxQ[nk] : null) ||
          null;
      }
      var q = null;
      if (pr.secteur && pr.quartier) {
        var qSec = chercherQ(pr.secteur);
        if (qSec && (bas(qSec.quartier) === bas(pr.quartier) || bas(qSec.secteur) === bas(pr.secteur))) q = qSec;
      }
      if (!q) q = chercherQ(pr.quartier) || chercherQ(pr.secteur);
      var ter = null;
      if (typeof resoudreTerritoire === 'function') {
        var entreeTer = {
          commune: pr.commune || '', quartier: pr.quartier || '', secteur: pr.secteur || '',
          subdivision: pr.subdivision || '', lieu: pr.lieu || ''
        };
        try {
          ter = resoudreTerritoire(entreeTer, data.quartiers);
          if (!ter || typeof ter !== 'object' || String(ter.commune) === '[object Object]' ||
              (!ter.territoire && !ter.subdivision && !ter.commune && !ter.quartier && !ter.secteur && !ter.zone)) {
            var ter2 = resoudreTerritoire(pr.commune, pr.quartier, pr.lieu, data.quartiers);
            if (ter2 && typeof ter2 === 'object' && String(ter2.commune) !== '[object Object]') ter = ter2;
            else if (ter && String(ter.commune) === '[object Object]') ter = null;
          }
        } catch (e) {
          try {
            var ter3 = resoudreTerritoire(pr.commune, pr.quartier, pr.lieu, data.quartiers);
            if (ter3 && typeof ter3 === 'object') ter = ter3;
          } catch (e2) { ter = null; }
        }
      }
      if (!q && ter) q = ter.q || (coordObj(ter) ? ter : null);
      var territoireRes = (ter && ter.territoire) || (q && q.territoire) || pr.territoire || '';
      var communeRes = (ter && ter.commune) || (q && q.commune) || pr.commune || '';
      var subdivisionRes = (ter && ter.subdivision) || (q && q.subdivision) || pr.subdivision || '';
      var quartierRes = (ter && ter.quartier) || (q && q.quartier) || pr.quartier || '';
      var secteurRes = (ter && ter.secteur) || (q && q.secteur) || pr.secteur || '';
      var zoneRes = (ter && ter.zone) || (q && q.zone) || pr.zone || '';
      var qCoord = coordObj(q) || coordObj(ter) || (ter && coordObj(ter.q)) || null;
      var coord = lireCoord(pr);
      var estInt = (typeof estCommuneInterieur === 'function' && estCommuneInterieur(communeRes)) ||
        cleNorm(territoireRes) === 'interieur' || cleNorm(zoneRes).indexOf('interieur') >= 0;
      if (coord && estInt && typeof estCoordonneeAbidjan === 'function' && estCoordonneeAbidjan(coord)) {
        coord = null;
      }
      // 3.31.36 : validation cartographique : si une table de référence vérifiée existe ou si le GPS diverge
      // de > 3,5 km du quartier déclaré dans le Grand Abidjan, corriger la position aberrante
      var refLieu = typeof trouverEtablissementRef === 'function' ? trouverEtablissementRef(pr.lieu) : null;
      var refCoord = coordObj(refLieu);
      if (refCoord && refCompatibleCommune(communeRes, refLieu) &&
          !(estInt && (!refLieu || !refLieu.commune || cleNorm(refLieu.commune) !== cleNorm(communeRes)))) {
        if (!coord || distanceVol(coord, refCoord) > 1.5) coord = refCoord;
      } else if (coord && qCoord && !estInt && typeof estCommuneGrandAbidjan === 'function' && estCommuneGrandAbidjan(communeRes)) {
        if (distanceVol(coord, qCoord) > 3.5) {
          var ke = cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || '');
          var ce = etabCoords[ke] || etabCoords[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')];
          if (ce && distanceVol(ce, qCoord) <= 3.5) coord = { lat: ce.lat, lon: ce.lon };
          else coord = { lat: qCoord.lat, lon: qCoord.lon, approx: true };
        }
      }
      if (!coord) {
        coord = qCoord ? { lat: qCoord.lat, lon: qCoord.lon, approx: true } :
          (typeof centroideVilleInterieur === 'function'
            ? (centroideVilleInterieur(communeRes) || centroideVilleInterieur(quartierRes) || centroideVilleInterieur(pr.commune) || centroideVilleInterieur(pr.quartier))
            : null);
        if (coord && !coord.approx) coord = { lat: coord.lat, lon: coord.lon, approx: true };
      }
      var hM = lireHoraire(pr.horaireMatin, R.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, R.horaireSoirDefaut);
      var st = (origId !== undefined && origId !== '' ? stats[String(origId)] : null) || stats[String(prId)], fiab = st && st.n >= 3 ? st.ok / st.n : 1;
      var kePr = cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || pr.commune || '');
      var etabPr = etabParCle[kePr] || etabParCle[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')] || (etabParNom[cleNorm(pr.lieu || '')] || null);
      var cleImm = (etabPr && etabPr.cle) || (cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || pr.commune || '') + '|' + cleNorm(quartierRes || pr.quartier || ''));
      if (!immeubles[cleImm]) {
        immeubles[cleImm] = {
          cle: cleImm, nom: pr.lieu || '', territoire: territoireRes, zone: zoneRes,
          commune: communeRes, subdivision: subdivisionRes,
          quartier: quartierRes, secteur: secteurRes, coord: coord
        };
      }
      JOURS_CLES.forEach(function (cle, j) {
        var d = lireDispo(pr[cle]);
        [['Matin', d.matin, hM], ['Soir', d.soir, hS]].forEach(function (x) {
          if (!x[1]) return;
          var c = {
            cle: prId + '|' + j + '|' + x[0], idPresence: prId, code: pr.code, jourIdx: j, jour: JOURS[j],
            creneau: x[0], debut: x[2][0], fin: x[2][1], lieu: pr.lieu, cleImmeuble: cleImm,
            territoire: territoireRes, subdivision: subdivisionRes,
            quartier: quartierRes, secteur: secteurRes,
            reperes: pr.reperes || '', commune: communeRes, zone: zoneRes, coord: coord, prat: p,
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
    return { prat: prat, parJour: parJour, parCode: parCode, presencesParCode: presencesParCode,
             immeubles: immeubles, idxQ: idxQ, parQ: parQ, ambiguQ: ambiguQ, quartiers: data.quartiers || [], feries: feries };
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
    if (p.prochaine && /^\d{4}-\d{2}-\d{2}$/.test(p.prochaine) && p.prochaine <= date) s += 120;
    return s;
  }

  // Arrêt de tournée (objet simple, enregistrable sur le téléphone)
  function arretDepuisCreneau(c, date) {
    var p = c.prat;
    return {
      uid: uid(), date: date, jour: c.jour, creneau: c.creneau, cle: c.cle, idPresence: c.idPresence,
      debut: minutesVersHeure(c.debut), fin: minutesVersHeure(c.fin), heure: minutesVersHeure(c.debut),
      code: p.code, nom: p.nom, type: p.type, specialite: p.specialite, note: p.note, conventionne: p.conv ? 'Oui' : 'Non',
      lieu: c.lieu, cleImmeuble: c.cleImmeuble || '', quartier: c.quartier, secteur: c.secteur || '', subdivision: c.subdivision || '',
      reperes: c.reperes || '', commune: c.commune, zone: c.zone, territoire: c.territoire || '',
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
    var coord = coordObj(a);
    var fixe = heureVersMinutes(a.fixe);
    if (fixe !== null) return { a: a, coord: coord, tot: fixe, tard: fixe + R.toleranceRdv, fixe: true };
    var rdv = heureVersMinutes(a.rdv || a.avance), deb = heureVersMinutes(a.debut), fin = heureVersMinutes(a.fin);
    if (rdv !== null) return { a: a, coord: coord, tot: rdv, tard: rdv + R.toleranceRdv };
    var tot = deb === null ? R.debutTravail : deb;
    var tard = (fin === null ? R.finTravail : fin) - R.dureeVisite;
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
    if (!it || !it.coord) return 0;
    var prev = i > 0 ? route[i - 1] : depart, next = i < route.length ? route[i] : null;
    var d1 = prev ? dist(prev, it) : null;
    var d2 = next ? dist(it, next) : null;
    var d3 = prev && next ? dist(prev, next) : null;
    return (d1 || 0) + (d2 || 0) - (d1 !== null && d2 !== null && d3 !== null ? d3 : 0);
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
  function coutOrdreBase(route, depart) {
    var s = simuler(route), km = 0, attente = 0, t = null, prev = depart;
    var vusEtab = {}, cleEtabPrev = null, coupesEtab = 0;
    var vusQCren = {}, cleQCrenPrev = null, coupesQuartierCren = 0;
    var vusQJour = {}, cleQJourPrev = null, coupesQuartierJour = 0;
    route.forEach(function (it, i) {
      if (it.fixe) {
        if (it.tot >= R.debutTravail && it.tot <= R.finTravail) {
          km += prev ? (dist(prev, it) || 0) : 0;
          t = Math.max(t === null ? 0 : t, it.tot + R.dureeVisite);
          prev = it;
        }
      } else {
        km += prev ? (dist(prev, it) || 0) : 0;
        if (t !== null) attente += Math.max(0, s.debuts[i] - (t + trajetMin(prev, it, t)));
        t = s.debuts[i] + R.dureeVisite; prev = it;
      }
      var cr = creneauDeItem(it);
      var ke = cleEtablissement(it) + '|' + cr;
      if (ke !== cleEtabPrev && vusEtab[ke]) coupesEtab++;
      vusEtab[ke] = true; cleEtabPrev = ke;
      var kq = cleQuartier(it), kqc = kq + '|' + cr;
      if (kqc !== cleQCrenPrev && vusQCren[kqc]) coupesQuartierCren++;
      vusQCren[kqc] = true; cleQCrenPrev = kqc;
      if (kq !== cleQJourPrev && vusQJour[kq]) coupesQuartierJour++;
      vusQJour[kq] = true; cleQJourPrev = kq;
    });
    // Priorité absolue : 0 retard (*1000) > ne jamais scinder un établissement (*100) >
    // finir un quartier réel avant d'en sortir (demi-journée *45, journée *12) > vraie distance routière (km) + attente
    // (les grands secteurs administratifs ne priment pas sur la géométrie réelle des quartiers)
    return {
      retards: s.nbRetards,
      cout: s.nbRetards * 1000 + coupesEtab * 100 + coupesQuartierCren * 45 + coupesQuartierJour * 12 + km + attente / 60
    };
  }
  function coutOrdre(route, depart) {
    var c = coutOrdreBase(route, depart);
    if (depart && route.length) c.cout += 0.2 * (dist(route[route.length - 1], depart) || 0);
    return c;
  }
  function ordonnerItems(items, depart) {
    if (items.length < 2) return items.slice();
    var fixes = [], libres = [];
    items.forEach(function (it) { if (it.fixe) fixes.push(it); else libres.push(it); });
    fixes.sort(function (a, b) { return a.tot - b.tot; });
    if (!libres.length) return fixes;
    function aplatir(ordre, sansQueueFixes) {
      if (!fixes.length) {
        var res = [];
        ordre.forEach(function (g) { res = res.concat(g); });
        return res;
      }
      var flat = [];
      ordre.forEach(function (g) { flat = flat.concat(g); });
      var r = [], fi = 0, t = null, prev = null;
      flat.forEach(function (it) {
        while (fi < fixes.length) {
          var fx = fixes[fi];
          var traj = prev ? trajetMin(prev, it, t) : 0;
          var deb = Math.max(t === null ? it.tot : t + traj, it.tot);
          if (it.tot >= fx.tot || (deb + R.dureeVisite > fx.tot && it.tard >= fx.tot + R.dureeVisite)) {
            r.push(fx);
            if (fx.tot >= R.debutTravail && fx.tot <= R.finTravail) {
              t = Math.max(t === null ? 0 : t, fx.tot + R.dureeVisite);
              prev = fx;
            }
            fi++;
          } else {
            break;
          }
        }
        r.push(it);
        var trajIt = prev ? trajetMin(prev, it, t) : 0;
        var debIt = Math.max(t === null ? it.tot : t + trajIt, it.tot);
        t = debIt + R.dureeVisite;
        prev = it;
      });
      if (!sansQueueFixes) {
        while (fi < fixes.length) r.push(fixes[fi++]);
      }
      return r;
    }
    if (libres.length < 2) return aplatir([libres]);
    var groupes = [], idx = {};
    libres.forEach(function (it) {
      var k = cleBlocLieu(it);
      if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push([]); }
      groupes[idx[k]].push(it);
    });
    groupes.forEach(function (g) { g.sort(function (a, b) { return a.tard - b.tard || a.tot - b.tot; }); });
    var best = null;
    function evaluer(ordre) {
      var r = aplatir(ordre), c = coutOrdre(r, depart);
      if (!best || c.cout < best.c.cout) best = { r: r, c: c };
    }
    if (groupes.length <= 9) {
      (function permuter(reste, pris) {
        if (!reste.length) { evaluer(pris); return; }
        if (best && pris.length >= 2) {
          var lb = coutOrdreBase(aplatir(pris, true), depart);
          if (lb.cout >= best.c.cout - 1e-6) return;   // Branch & Bound : borne inférieure admissible monotone
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
    return best ? best.r : aplatir([libres]);
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
    if (apres) its.forEach(function (it) { if (!it.fixe && !it.a.rdv && !it.a.avance && !it.a.statut) it.tot = Math.max(it.tot, apres); });
    its.sort(function (a, b) { return a.tot - b.tot || a.tard - b.tard; });
    var route = [], dep = depart ? { coord: depart } : null;
    its.forEach(function (it) { route = insererAuMieux(route, it, dep); });
    return finaliser(meilleurOrdre(route, dep), dep);
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
  function cleQuartier(it) {
    var a = it.a;
    var comBase = typeof communeParente === 'function' ? communeParente(a.commune) : a.commune;
    var qRef = a.quartier || a.secteur || '';
    if (a.secteur && cleNorm(a.quartier) === cleNorm(comBase)) qRef = a.secteur;
    var k = cleSecteur(qRef, comBase);
    return k ? k + '|' + cleNorm(comBase) : cleEtablissement(it);
  }
  // 3.28.23 : secteur de la tournée : subdivision issue de Quartiers (sinon sous-secteur des grandes communes, sinon commune)
  function nomSecteurTournee(a, quartiers) {
    if (!a) return '';
    if (a.subdivision) return a.subdivision;
    var qNom = a.quartier || a.secteur || '';
    if (quartiers && quartiers.length && qNom) {
      var kc = bas(a.commune), kp = typeof communeParente === 'function' ? bas(communeParente(a.commune)) : kc;
      var kq = bas(qNom), ks = bas(a.secteur);
      for (var i = 0; i < quartiers.length; i++) {
        var q = quartiers[i];
        if (!q || !q.subdivision) continue;
        var qkc = bas(q.commune), qkp = typeof communeParente === 'function' ? bas(communeParente(q.commune)) : qkc;
        if (kc && qkc !== kc && qkp !== kp) continue;
        if ((kq && (bas(q.quartier) === kq || bas(q.secteur) === kq)) ||
            (ks && (bas(q.quartier) === ks || bas(q.secteur) === ks))) {
          return q.subdivision;
        }
      }
    }
    if (typeof resoudreTerritoire === 'function') {
      var rT = resoudreTerritoire(a, quartiers);
      if (rT && rT.subdivision) return rT.subdivision;
    }
    var z = typeof zoneDeQuartier === 'function' ? zoneDeQuartier(a.commune, qNom, a.lieu, quartiers) : '';
    if (z) return z;
    if (typeof estGrandeCommune === 'function' && estGrandeCommune(a.commune) && qNom && bas(qNom) !== bas(a.commune)) {
      return a.commune + ' – ' + qNom;
    }
    return a.commune || a.quartier || a.secteur || '';
  }
  function cleSecteurTournee(it, quartiers) { var k = cleNorm(nomSecteurTournee(it.a, quartiers)); return k || cleQuartier(it); }
  function regrouper(route, depart) {
    if (route.length < 3 || route.some(function (it) { return it.fixe; })) return route;   // visites déjà faites : ordre réel gardé
    var ref = simuler(route), finRef = ref.debuts.length ? Math.max.apply(null, ref.debuts) : 0;
    var coutRef = coutOrdre(route, depart);
    function acceptable(r) {
      var s = simuler(r);
      if (s.nbRetards > ref.nbRetards || (s.debuts.length ? Math.max.apply(null, s.debuts) : 0) > finRef + 20) return false;
      // Ne jamais dégrader l'itinéraire géographique optimisé par le TSP
      return coutOrdre(r, depart).cout <= coutRef.cout + 0.5;
    }
    function grouperPar(r, cle) {   // ordre des groupes = ordre de leur première visite
      var ordre = [], par = {};
      r.forEach(function (it) { var k = cle(it); if (!par[k]) { par[k] = []; ordre.push(k); } par[k].push(it); });
      return ordre.reduce(function (l, k) { return l.concat(par[k]); }, []);
    }
    // 1. d'un coup, si possible (même spécialité dans un même établissement sans détour ni retard)
    var r0 = grouperPar(route, cleLieuSpec), r1 = grouperPar(r0, cleEtablissement);
    var r = acceptable(r1) ? r1 : (acceptable(r0) ? r0 : route.slice());
    // 2. sinon, visite par visite : rapprochée de la dernière visite du même hôpital si cela ne rallonge pas la tournée
    [cleLieuSpec, cleEtablissement].forEach(function (cle) {
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

  function finaliser(route, depart) {
    route = regrouper(route, depart);
    var s = simuler(route);
    return route.map(function (it, i) {
      var a = it.a;
      a.heure = minutesVersHeure(s.debuts[i]);
      a.retard = s.retards[i];
      a.dist = i > 0 ? Math.round((dist(route[i - 1], it) || 0) * 10) / 10 : 0;
      a.trajet = i > 0 ? trajetMin(route[i - 1], it, s.debuts[i - 1] + R.dureeVisite) : 0;
      return a;
    });
  }

  // ------------------------------------------------------------------ Construction d'une journée
  // Candidats éligibles pour une date donnée (réutilisé par genererPlanning pour estimer la charge)
  function filtrerImmeubles(ctx, communes, cache) {
    if (!communes || !communes.length || !ctx.immeubles) return null;
    var cle = communes.join('|');
    if (cache && cache[cle]) return cache[cle];
    var dans = {};
    communes.forEach(function (c) { dans[c] = true; });
    var ok = {};
    var cles = Object.keys(ctx.immeubles);
    for (var i = 0; i < cles.length; i++) {
      var k = cles[i];
      var imm = ctx.immeubles[k];
      var match = typeof communeCorrespondante === 'function' ? communeCorrespondante(imm, dans, ctx.quartiers) : !!dans[imm.commune];
      if (match) ok[k] = true;
    }
    if (cache) cache[cle] = ok;
    return ok;
  }

  function candidatsJour(ctx, date, o, utilises) {
    var j = jourSemaineIndex(date);
    if (isNaN(j) || j < 0 || j > 4 || (ctx.feries && ctx.feries[date])) return [];
    var immOk = o.immeublesOk || (o.communes && o.communes.length && ctx.immeubles ? filtrerImmeubles(ctx, o.communes, o._immCache) : null);
    var dans = null;
    if (!immOk && o.communes && o.communes.length) { dans = {}; o.communes.forEach(function (c) { dans[c] = true; }); }
    var out = [];
    ctx.parJour[j].forEach(function (c) {
      if (utilises && utilises[c.code]) return;
      if (o.exclus && o.exclus[c.code]) return;
      if (immOk) {
        if (!immOk[c.cleImmeuble]) return;
      } else if (dans && !(typeof communeCorrespondante === 'function' ? communeCorrespondante(c, dans, ctx.quartiers) : dans[c.commune])) {
        return;
      }
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
    var totalCible = targetMatin + targetSoir;
    var tM = route.length < totalCible ? Math.ceil(route.length / 2) : targetMatin;
    var tS = route.length < totalCible ? route.length - tM : targetSoir;
    var candsParCode = {};
    for (var ci = 0; ci < cands.length; ci++) {
      var cc = cands[ci], codeC = cc.a.code;
      (candsParCode[codeC] = candsParCode[codeC] || []).push(cc);
    }
    for (var step = 0; step < route.length; step++) {
      var curM = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
      var curS = route.length - curM;
      var sur = curM > tM + (curS < tS ? 0 : 1) ? 'Matin' : (curS > tS + (curM < tM ? 0 : 1) ? 'Soir' : '');
      if (!sur) break;
      var cibleCren = sur === 'Matin' ? 'Soir' : 'Matin';
      var refCost = coutOrdre(route, depart);
      var meilleur = null;
      for (var i = 0; i < route.length; i++) {
        var it = route[i], a = it.a;
        if (it.fixe || a.impose || a.garde || a.rdv || a.statut || a.etat === 'valide' || creneauDeItem(it) !== sur) continue;
        var alt = (candsParCode[a.code] || []).filter(function (cd) { return cd.a.creneau === cibleCren; })
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

  function filtrerFixesJour(rawFixes, maxFixes) {
    var faitsFixes = rawFixes.filter(function (a) { return !!a.statut; });
    var planFixes = rawFixes.filter(function (a) { return !a.statut; });
    if (planFixes.length > Math.max(0, maxFixes - faitsFixes.length)) {
      planFixes.sort(function (a, b) {
        var pa = (a.impose || a.etape || a.rdv) ? 0 : 1;
        var pb = (b.impose || b.etape || b.rdv) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        var ga = a.garde ? 0 : 1;
        var gb = b.garde ? 0 : 1;
        if (ga !== gb) return ga - gb;
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return item(a).tot - item(b).tot;
      });
      planFixes = planFixes.slice(0, Math.max(0, maxFixes - faitsFixes.length));
    }
    return faitsFixes.concat(planFixes);
  }

  // o : { communes: [..] | null, maxJour, targetJour, delai, exclus, rejetes, autreDispos, fixes: [arrêts], depart }
  function planifierJour(ctx, date, o, utilises) {
    var j = jourSemaineIndex(date);
    var depart = o.depart ? { coord: o.depart } : null;
    var max = o.maxJour !== undefined && o.maxJour !== null ? o.maxJour : 8;
    var fixesGardes = filtrerFixesJour((o.fixes || []).slice(), max);
    var route = [];
    fixesGardes.sort(function (a, b) { return item(a).tot - item(b).tot; })
      .forEach(function (a) { route = insererAuMieux(route, item(a), depart); });
    if (isNaN(j) || j < 0 || j > 4 || (ctx.feries && ctx.feries[date])) return finaliser(route, depart);

    var creneaux = candidatsJour(ctx, date, o, utilises);
    var cands = creneaux.map(function (c) {
      var a = arretDepuisCreneau(c, date);
      return { a: a, it: item(a), score: a.score * (0.5 + 0.5 * a.fiab), rejete: !!(o.rejetes && o.rejetes[c.code]) };
    });

    // Pré-calcul unique par immeuble des clés quartier/secteur (évite de rescanner 472 quartiers à chaque étape)
    var cleQImm = {}, cleZImm = {};
    cands.forEach(function (cd) {
      var ki = cd.a.cleImmeuble || cd.a.code;
      if (cleQImm[ki] === undefined) {
        cleQImm[ki] = cleQuartier(cd.it);
        cleZImm[ki] = cleSecteurTournee(cd.it, ctx.quartiers);
      }
      cd.cleQ = cleQImm[ki];
      cd.cleZ = cleZImm[ki];
    });

    // Densité géographique par immeuble (avec arrêt anticipé dès le plafond de 6 voisins)
    var densite = {}, noeudsMap = {}, noeuds = [];
    for (var ni = 0; ni < cands.length; ni++) {
      var nc = cands[ni], ki = nc.a.cleImmeuble || nc.a.code;
      var nd = noeudsMap[ki];
      if (!nd) { nd = noeudsMap[ki] = { it: nc.it, codes: {}, nCodes: 0 }; noeuds.push(nd); }
      if (!nd.codes[nc.a.code]) { nd.codes[nc.a.code] = true; nd.nCodes++; }
    }
    for (var ia = 0; ia < noeuds.length; ia++) {
      var nA = noeuds[ia], totalVoisins = nA.nCodes - 1;
      if (totalVoisins < 6) {
        for (var ib = 0; ib < noeuds.length; ib++) {
          if (ia === ib) continue;
          var dN = dist(nA.it, noeuds[ib].it);
          if (dN !== null && dN <= 2.5) {
            totalVoisins += noeuds[ib].nCodes;
            if (totalVoisins >= 6) break;
          }
        }
      }
      var scoreDens = Math.min(6, totalVoisins) * 8;
      var codesA = Object.keys(nA.codes);
      for (var ic = 0; ic < codesA.length; ic++) {
        if (densite[codesA[ic]] === undefined) densite[codesA[ic]] = scoreDens;
      }
    }

    var cibleJour = Math.min(max, Math.max(route.length, o.targetJour !== undefined && o.targetJour !== null ? o.targetJour : max));
    var targetMatin = Math.ceil(cibleJour / 2), targetSoir = cibleJour - targetMatin;

    function passe(avecRejetes) {
      while (route.length < cibleJour) {
        var dansRoute = {}, routeQ = {}, routeZ = {};
        route.forEach(function (it) {
          dansRoute[it.a.code] = true;
          routeQ[cleQuartier(it)] = true;
          routeZ[cleSecteurTournee(it, ctx.quartiers)] = true;
        });
        var curMatin = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
        var curSoir = route.length - curMatin;
        var base = simuler(route).nbRetards;
        var deltaImm = {}, top = [], TOP_K = 32, minTopV = -Infinity, minTopIdx = 0;
        var evalCands = function (collectAll) {
          var allOpts = collectAll ? [] : null;
          for (var ci = 0; ci < cands.length; ci++) {
            var cd = cands[ci];
            if (dansRoute[cd.a.code] || (cd.rejete && !avecRejetes)) continue;
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
              ? (routeQ[cd.cleQ] ? 45 : (routeZ[cd.cleZ] ? 25 : 0))
              : (densite[cd.a.code] || 0);
            var penRarete = o.autreDispos ? -12 * (o.autreDispos[cd.a.code] || 0) : 0;
            var baseScore = cd.score + bonusEquilibre + bonusZone + penRarete;
            var ki = cd.a.cleImmeuble || '';
            var dCache = ki ? (deltaImm[ki] || (deltaImm[ki] = [])) : null;
            for (var i = 0; i <= route.length; i++) {
              var dKm;
              if (dCache) {
                dKm = dCache[i];
                if (dKm === undefined) { dKm = delta(route, i, cd.it, depart); dCache[i] = dKm; }
              } else {
                dKm = delta(route, i, cd.it, depart);
              }
              var v = baseScore - R.penaliteKm * dKm;
              if (collectAll) {
                allOpts.push({ v: v, cd: cd, i: i });
              } else if (top.length < TOP_K) {
                top.push({ v: v, cd: cd, i: i });
                if (top.length === TOP_K) {
                  minTopV = top[0].v; minTopIdx = 0;
                  for (var ti = 1; ti < TOP_K; ti++) {
                    if (top[ti].v < minTopV) { minTopV = top[ti].v; minTopIdx = ti; }
                  }
                }
              } else if (v > minTopV) {
                top[minTopIdx] = { v: v, cd: cd, i: i };
                minTopV = top[0].v; minTopIdx = 0;
                for (var tj = 1; tj < TOP_K; tj++) {
                  if (top[tj].v < minTopV) { minTopV = top[tj].v; minTopIdx = tj; }
                }
              }
            }
          }
          return allOpts;
        };
        evalCands(false);
        if (!top.length) return;
        top.sort(function (x, y) { return y.v - x.v; });
        var pris = false, triedByCren = {};
        for (var k = 0; k < top.length; k++) {
          var op = top[k], cr = creneauDeItem(op.cd.it);
          if ((triedByCren[cr] || 0) >= 6000) continue;
          triedByCren[cr] = (triedByCren[cr] || 0) + 1;
          var essai = route.slice(0, op.i).concat([op.cd.it], route.slice(op.i));
          var s = simuler(essai);
          if (!s.retards[op.i] && s.nbRetards <= base) { route = essai; pris = true; break; }
        }
        if (!pris && top.length === TOP_K) {
          var options = evalCands(true);
          options.sort(function (x, y) { return y.v - x.v; });
          for (var k2 = 0; k2 < options.length; k2++) {
            var op2 = options[k2], cr2 = creneauDeItem(op2.cd.it);
            if ((triedByCren[cr2] || 0) >= 6000) continue;
            triedByCren[cr2] = (triedByCren[cr2] || 0) + 1;
            var essai2 = route.slice(0, op2.i).concat([op2.cd.it], route.slice(op2.i));
            var s2 = simuler(essai2);
            if (!s2.retards[op2.i] && s2.nbRetards <= base) { route = essai2; pris = true; break; }
          }
        }
        if (!pris) return;
      }
    }
    passe(false);
    if (route.length < cibleJour) passe(true);
    route = equilibrerCreneaux(meilleurOrdre(route, depart), cands, depart, targetMatin, targetSoir);
    route.forEach(function (it) { utilises[it.a.code] = true; });
    return finaliser(route, depart);
  }

  // ------------------------------------------------------------------ Planning d'une période
  // p : { dates, communesPour(date), maxJour, delai, exclus, rejetes, conserves: [arrêts],
  //       imposes: [{ code, date?, cle?, rdv? }], depart, accepte(praticien) : filtre spécialités / types }
  function genererPlanning(ctx, p) {
    var maxJ = p.maxJour !== undefined && p.maxJour !== null ? p.maxJour : 8;
    var utilises = {}, fixes = {}, nonPlaces = [], conservesHors = [], imposesPlaces = [];
    p.dates.forEach(function (d) { fixes[d] = []; });
    (p.conserves || []).forEach(function (a) {
      if (fixes[a.date]) fixes[a.date].push(a);
      else { utilises[a.code] = true; conservesHors.push(a); }
    });
    p.dates.forEach(function (d) {
      fixes[d] = filtrerFixesJour(fixes[d], maxJ);
      fixes[d].forEach(function (a) { utilises[a.code] = true; });
    });

    // 3.28.17 : un lieu hors des communes choisies pour ce jour n'est pris que pour un RDV ou prioritaire choisi à la main
    function dansCommunes(c, d) {
      var l = p.communesPour ? p.communesPour(d) : null;
      if (!l || !l.length) return true;
      var dans = {}; l.forEach(function (x) { dans[x] = true; });
      return typeof communeCorrespondante === 'function' ? communeCorrespondante(c, dans, ctx.quartiers) : !!dans[c.commune];
    }
    (p.imposes || []).forEach(function (im) {
      if (utilises[im.code]) return;
      var rdv = heureVersMinutes(im.rdv), options = [], horsZone = 0;
      p.dates.forEach(function (d) {
        var j = jourSemaineIndex(d);
        if (isNaN(j) || j < 0 || j > 4 || (im.date && im.date !== d) || (im.apres && d < im.apres) || (ctx.feries && ctx.feries[d])) return;
        (ctx.parCode[im.code] || []).forEach(function (c) {
          if (c.jourIdx !== j || (im.cle && im.cle !== c.cle) || absentLe(c.prat, d)) return;
          var ok = dansCommunes(c, d);
          if (!ok) horsZone++;
          // RDV repris de l'historique (étape) : jamais hors des communes du jour
          if (ok || !im.etape) options.push({ d: d, c: c, hors: ok ? 0 : 1 });
        });
      });
      if (!options.length) {
        nonPlaces.push(horsZone ? Object.assign({}, im, { horsCommunes: true }) : Object.assign({}, im));
        return;
      }
      options.sort(function (x, y) {
        var fx = fixes[x.d].length < maxJ ? 0 : 1;
        var fy = fixes[y.d].length < maxJ ? 0 : 1;
        var cx = rdv !== null && x.c.debut <= rdv && rdv <= x.c.fin ? 0 : 1;
        var cy = rdv !== null && y.c.debut <= rdv && rdv <= y.c.fin ? 0 : 1;
        return fx - fy || cx - cy || x.hors - y.hors || fixes[x.d].length - fixes[y.d].length || (x.d < y.d ? -1 : x.d > y.d ? 1 : 0) || x.c.debut - y.c.debut;
      });
      var o = options[0], a = arretDepuisCreneau(o.c, o.d);
      a.impose = true; a.garde = true; if (im.etape) { a.etape = true; a.rdvDate = im.dateRdv || im.apres || ''; a.rdvPrisLe = im.prisLe || ''; }
      if (rdv !== null) a.rdv = minutesVersHeure(rdv);
      fixes[o.d].push(a);
      imposesPlaces.push({ a: a, im: im, date: o.d });
      utilises[im.code] = true;
    });
    if (imposesPlaces.length) {
      utilises = {};
      conservesHors.forEach(function (a) { utilises[a.code] = true; });
      p.dates.forEach(function (d) {
        fixes[d] = filtrerFixesJour(fixes[d], maxJ);
        fixes[d].forEach(function (a) { utilises[a.code] = true; });
      });
      imposesPlaces.forEach(function (entry) {
        if (fixes[entry.date].indexOf(entry.a) < 0) nonPlaces.push(Object.assign({}, entry.im));
      });
    }

    // Répartition équilibrée de la charge sur l'ensemble des jours ouvrés de la période
    var immCache = {};
    var ouverts = p.dates.filter(function (d) { var j = jourSemaineIndex(d); return !isNaN(j) && j >= 0 && j <= 4 && !(ctx.feries && ctx.feries[d]); });
    var codesParJour = {}, poolUnique = {}, nbDisposCode = {};
    ouverts.forEach(function (d) {
      var opts = { communes: p.communesPour ? p.communesPour(d) : null, _immCache: immCache, delai: p.delai, exclus: p.exclus, accepte: p.accepte };
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
        communes: p.communesPour ? p.communesPour(d) : null, _immCache: immCache, maxJour: maxJ, targetJour: ciblesJour[d] !== undefined ? ciblesJour[d] : maxJ,
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
    if (isNaN(j) || j < 0 || j > 4 || !pos || (ctx.feries && ctx.feries[date])) return [];
    var meilleurs = {};
    ctx.parJour[j].forEach(function (c) {
      if (c.prat && absentLe(c.prat, date)) return;
      var pharma = c.prat && c.prat.type === 'Pharmacie';
      var d = distanceVol(pos, c.coord);   // 3.25.9 : vol d'oiseau depuis le téléphone
      if (d === null) return;
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
      var d = distanceKm(p, q);
      if (d === null) return;
      d = d / R.detourRoutier;
      if (d < bestD) { bestD = d; best = q; }
    });
    return best ? { quartier: best, km: bestD } : null;
  }

  // ------------------------------------------------------------------ Couverture géographique
  // mesArrets / arretsEquipe : arrêts sur les dates considérées
  function couverture(ctx, dates, mesArrets, arretsEquipe) {
    var jours = {};
    dates.forEach(function (d) { var j = jourSemaineIndex(d); if (!isNaN(j) && j >= 0 && j < 5) jours[j] = d; });
    var communes = {}, ordreZones = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest', 'Intérieur', 'Zone Intérieur'];
    function rangZone(z) {
      if (z === 'Intérieur' || z === 'Zone Intérieur') return 5;
      var idx = ordreZones.indexOf(z);
      return idx >= 0 ? idx : ordreZones.length;
    }
    function trouverCommuneCouv(nom) {
      if (!nom) return null;
      if (communes[nom]) return communes[nom];
      var par = typeof communeParente === 'function' ? communeParente(nom) : '';
      return par && communes[par] ? communes[par] : null;
    }
    (ctx.quartiers || []).forEach(function (q) {
      if (!q || !q.commune) return;
      if (!communes[q.commune]) communes[q.commune] = { commune: q.commune, zone: q.zone || '', moi: 0, equipe: {}, dispo: {}, prioritaires: {} };
    });
    (mesArrets || []).forEach(function (a) { var c = trouverCommuneCouv(a.commune); if (c) c.moi++; });
    (arretsEquipe || []).forEach(function (a) {
      var c = trouverCommuneCouv(a.commune); if (!c) return;
      c.equipe[a.delegue] = (c.equipe[a.delegue] || 0) + 1;
    });
    Object.keys(jours).forEach(function (j) {
      ctx.parJour[j].forEach(function (cr) {
        var c = trouverCommuneCouv(cr.commune); if (!c) return;
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
      return rangZone(a.zone) - rangZone(b.zone) || a.commune.localeCompare(b.commune, 'fr');
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
      if (v.rdv === false) {
        if (compte) p.prochaine = '';
      } else if (v.prochaine) {
        p.prochaine = v.prochaine;
      } else if (compte) {
        p.prochaine = '';
      }
      p.statut = v.statut;
      p.commentaire = v.commentaire || '';
    });
  }

  return {
    preparer: preparer, creneauParCle: creneauParCle, arretDepuisCreneau: arretDepuisCreneau, scoreDe: scoreDe,
    simuler: simuler, ordonnerJour: ordonnerJour, planifierJour: planifierJour, genererPlanning: genererPlanning,
    autourDe: autourDe, quartierLePlusProche: quartierLePlusProche, couverture: couverture, cleSecteur: cleSecteur,
    cleQuartier: cleQuartier, cleSecteurTournee: cleSecteurTournee, nomSecteurTournee: nomSecteurTournee,
    estVisite: estVisite, appliquerVisite: appliquerVisite, item: item, uid: uid, evaluerInsertion: evaluerInsertion
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
