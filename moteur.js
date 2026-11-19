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
    definirQuartiersMoteur(data && data.quartiers);   // 3.31.58 : clés de secteur tirées de l'onglet Quartiers
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
      var terE = null;
      if (typeof resoudreTerritoire === 'function') {
        try {
          terE = resoudreTerritoire({
            commune: e.commune || '', subdivision: e.subdivision || '',
            // 3.31.58 : le quartier saisi fait foi ; un secteur resté de l'ancien quartier n'est plus pris
            quartier: e.quartier || '', secteur: e.quartier ? '' : (e.secteur || ''), lieu: e.nom || ''
          }, data.quartiers);
        } catch (errE) { terE = null; }
      }
      var eTerr = (terE && terE.territoire) || e.territoire || '';
      var eZone = (terE && terE.zone) || e.zone || '';
      var eCom = (terE && terE.commune) || e.commune || '';
      var eSub = (terE && terE.subdivision) || e.subdivision || '';
      var eQua = (terE && terE.quartier) || e.quartier || '';
      var eSec = (terE && terE.secteur) || (e.quartier ? '' : e.secteur) || '';
      var keOrig = cleNorm(e.nom || '') + '|' + cleNorm(e.commune || '');
      var ke = cleNorm(e.nom || '') + '|' + cleNorm(eCom || e.commune || '');
      var kn = cleNorm(e.nom || '');
      var co = lireCoord(e) || coordObj(terE);
      if (ke && co) {
        var refE = typeof trouverEtablissementRef === 'function' ? trouverEtablissementRef(e.nom) : null;
        var refEC = coordObj(refE);
        if (refEC && refCompatibleCommune(eCom || e.commune, refE) && distanceVol(co, refEC) > 1.5) co = refEC;
        etabCoords[ke] = co;
        if (keOrig) etabCoords[keOrig] = co;
      }
      if (ke) {
        var immE = {
          cle: ke, nom: e.nom || '', territoire: eTerr, zone: eZone,
          commune: eCom, subdivision: eSub,
          quartier: eQua, secteur: eSec, coord: co || null
        };
        etabParCle[ke] = immE;
        if (keOrig) etabParCle[keOrig] = immE;
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
      // 3.31.58 : l'établissement (onglet Etablissements) fait foi pour le quartier de son lieu : un quartier modifié
      // dans Etablissements s'applique aussitôt, même si la ligne de Présences garde encore l'ancien quartier ou secteur
      var etab0 = etabParCle[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')] || etabParNom[cleNorm(pr.lieu || '')] || null;
      if (etab0 && etab0.quartier && p.type !== 'Pharmacie') {
        pr = Object.assign({}, pr, { quartier: etab0.quartier, secteur: etab0.secteur || '', subdivision: etab0.subdivision || '', commune: etab0.commune || pr.commune });
      }
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
        // 3.31.58 : un secteur resté d'un ancien quartier (secteur qui n'appartient pas au quartier) n'est plus pris
        var secOk = pr.secteur && (!pr.quartier || !chercherQ(pr.secteur) || bas(chercherQ(pr.secteur).quartier) === bas(pr.quartier)) ? pr.secteur : '';
        var entreeTer = {
          commune: pr.commune || '', quartier: pr.quartier || '', secteur: secOk || '',
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
      var kePrInit = cleNorm(pr.lieu || '') + '|' + cleNorm((ter && ter.commune) || (q && q.commune) || pr.commune || '');
      var etabPr = etabParCle[kePrInit] || etabParCle[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')] || (etabParNom[cleNorm(pr.lieu || '')] || null);
      var terMatched = !!(ter && ter.matched);
      var territoireRes = (terMatched && ter.territoire) || (etabPr && etabPr.territoire) || (ter && ter.territoire) || (q && q.territoire) || pr.territoire || '';
      var communeRes = (terMatched && ter.commune) || (etabPr && etabPr.commune) || (ter && ter.commune) || (q && q.commune) || pr.commune || '';
      var subdivisionRes = (terMatched && ter.subdivision) || (etabPr && etabPr.subdivision) || (ter && ter.subdivision) || (q && q.subdivision) || pr.subdivision || '';
      var quartierRes = (terMatched && ter.quartier) || (etabPr && etabPr.quartier) || (ter && ter.quartier) || (q && q.quartier) || pr.quartier || '';
      var secteurRes = (terMatched && ter.secteur) || (etabPr && etabPr.secteur) || (ter && ter.secteur) || (q && q.secteur) || pr.secteur || '';
      var zoneRes = (terMatched && ter.zone) || (etabPr && etabPr.zone) || (ter && ter.zone) || (q && q.zone) || pr.zone || '';
      var qCoord = coordObj(q) || coordObj(ter) || (ter && coordObj(ter.q)) || null;
      var coord = lireCoord(pr);
      var estInt = (typeof estCommuneInterieur === 'function' && estCommuneInterieur(communeRes)) ||
        cleNorm(territoireRes) === 'interieur' || cleNorm(zoneRes).indexOf('interieur') >= 0;
      if (coord && estInt && typeof estCoordonneeAbidjan === 'function' && estCoordonneeAbidjan(coord)) {
        coord = null;
      }
      // 3.31.36 / 3.31.56 : validation cartographique : une position captée sur le terrain (Terrain / Repertoire Hopital)
      // est toujours prioritaire et conservée telle quelle.
      var estOrigineTerrain = /terrain|repertoire hopital/i.test(String(pr.origineGps || ''));
      var refLieu = typeof trouverEtablissementRef === 'function' ? trouverEtablissementRef(pr.lieu) : null;
      var refCoord = coordObj(refLieu);
      if (!estOrigineTerrain && refCoord && refCompatibleCommune(communeRes, refLieu) &&
          !(estInt && (!refLieu || !refLieu.commune || cleNorm(refLieu.commune) !== cleNorm(communeRes)))) {
        if (!coord || distanceVol(coord, refCoord) > 1.5) coord = refCoord;
      } else if (!estOrigineTerrain && coord && qCoord && !estInt && typeof estCommuneGrandAbidjan === 'function' && estCommuneGrandAbidjan(communeRes)) {
        if (distanceVol(coord, qCoord) > 3.5) {
          var ke = cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || '');
          var ce = etabCoords[ke] || etabCoords[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')];
          if (ce && distanceVol(ce, qCoord) <= 3.5) coord = { lat: ce.lat, lon: ce.lon };
          else coord = { lat: qCoord.lat, lon: qCoord.lon, approx: true };
        }
      }
      if (!coord) {
        var ke0 = cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || '');
        var ce0 = etabCoords[ke0] || etabCoords[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')] || coordObj(etabPr);
        if (ce0) coord = { lat: ce0.lat, lon: ce0.lon };
      }
      if (!coord) {
        coord = qCoord ? { lat: qCoord.lat, lon: qCoord.lon, approx: true } :
          (typeof centroideVilleInterieur === 'function'
            ? (centroideVilleInterieur(communeRes) || centroideVilleInterieur(quartierRes) || centroideVilleInterieur(pr.commune) || centroideVilleInterieur(pr.quartier))
            : null);
        if (coord && !coord.approx) coord = { lat: coord.lat, lon: coord.lon, approx: true };
      }
      var hM = lireHoraire(pr.horaireMatin, R.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, R.horaireSoirDefaut);
      var hMStr0 = minutesVersHeure(hM[0]), hMStr1 = minutesVersHeure(hM[1]);
      var hSStr0 = minutesVersHeure(hS[0]), hSStr1 = minutesVersHeure(hS[1]);
      var st = (origId !== undefined && origId !== '' ? stats[String(origId)] : null) || stats[String(prId)], fiab = st && st.n >= 3 ? st.ok / st.n : 1;
      var kePr = cleNorm(pr.lieu || '') + '|' + cleNorm(communeRes || pr.commune || '');
      if (!etabPr) etabPr = etabParCle[kePr] || etabParCle[cleNorm(pr.lieu || '') + '|' + cleNorm(pr.commune || '')] || (etabParNom[cleNorm(pr.lieu || '')] || null);
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
        [['Matin', d.matin, hM, hMStr0, hMStr1], ['Soir', d.soir, hS, hSStr0, hSStr1]].forEach(function (x) {
          if (!x[1]) return;
          var c = {
            cle: prId + '|' + j + '|' + x[0], idPresence: prId, code: pr.code, jourIdx: j, jour: JOURS[j],
            creneau: x[0], debut: x[2][0], fin: x[2][1], debutStr: x[3], finStr: x[4], lieu: pr.lieu, cleImmeuble: cleImm,
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

  var _favorisMap = {};
  function definirFavoris(m) { _favorisMap = (m && typeof m === 'object') ? m : {}; }
  // Score : potentiel + retard de visite (cadence doublée pour les favoris + bonus permanent) + bonus si une « prochaine étape » est arrivée à échéance
  function scoreDe(p, date, favoris) {
    var fav = favoris || _favorisMap;
    var isFav = !!(p && fav && fav[p.code]);
    var jE = joursEcoules(p.derniere, date);
    var s = calcScore(p.note, isFav ? jE * 2 : jE, p.statut);
    if (isFav) s += 500;
    if (p.prochaine && /^\d{4}-\d{2}-\d{2}$/.test(p.prochaine) && p.prochaine <= date) s += 120;
    return s;
  }

  // Arrêt de tournée (objet simple, enregistrable sur le téléphone)
  function arretDepuisCreneau(c, date) {
    var p = c.prat;
    return {
      uid: uid(), date: date, jour: c.jour, creneau: c.creneau, cle: c.cle, idPresence: c.idPresence,
      debut: c.debutStr || minutesVersHeure(c.debut), fin: c.finStr || minutesVersHeure(c.fin), heure: c.debutStr || minutesVersHeure(c.debut),
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
  function keysOrdre(it) {
    var cr = creneauDeItem(it), k = it._kOrd;
    if (k && k.cr === cr) return k;
    var keJ = cleEtablissement(it);
    var kCom = cleNorm(typeof communeParente === 'function' ? communeParente(it.a.commune) : it.a.commune);
    var kz = cleZoneSecteur(it);
    var kq = cleQuartier(it);
    return (it._kOrd = { cr: cr, keJ: keJ, ke: keJ + '|' + cr, kCom: kCom, kz: kz, kzc: kz + '|' + cr, kq: kq, kqc: kq + '|' + cr });
  }
  function coutOrdreBase(route, depart) {
    var nbRetards = 0, km = 0, attente = 0, t = null, prevKm = depart, prevSim = null;
    var vusEtab = {}, cleEtabPrev = null, coupesEtab = 0;
    var vusEtabJour = {}, cleEtabJourPrev = null, coupesEtabJour = 0;
    var vusComJour = {}, cleComJourPrev = null, coupesComJour = 0;
    var vusZCren = {}, cleZCrenPrev = null, coupesSecteurCren = 0;
    var vusZJour = {}, cleZJourPrev = null, coupesSecteurJour = 0;
    var vusQCren = {}, cleQCrenPrev = null, coupesQuartierCren = 0;
    var vusQJour = {}, cleQJourPrev = null, coupesQuartierJour = 0;
    for (var i = 0; i < route.length; i++) {
      var it = route[i];
      if (it.fixe) {
        if (it.tot >= R.debutTravail && it.tot <= R.finTravail) {
          km += prevKm ? (dist(prevKm, it) || 0) : 0;
          t = Math.max(t === null ? 0 : t, it.tot + R.dureeVisite);
          prevKm = it; prevSim = it;
        }
      } else {
        var dKm = prevKm ? (dist(prevKm, it) || 0) : 0;
        km += dKm;
        var traj = prevSim ? minutesTrajet(dKm, prevSim.a.commune, it.a.commune, t) : 0;
        var arrivee = t === null ? it.tot : t + traj;
        var deb = Math.max(arrivee, it.tot);
        if (deb > it.tard) nbRetards++;
        if (t !== null) attente += Math.max(0, deb - arrivee);
        t = deb + R.dureeVisite; prevKm = it; prevSim = it;
      }
      var ki = keysOrdre(it);
      if (ki.ke !== cleEtabPrev && vusEtab[ki.ke]) coupesEtab++;
      vusEtab[ki.ke] = true; cleEtabPrev = ki.ke;
      if (ki.keJ !== cleEtabJourPrev && vusEtabJour[ki.keJ]) coupesEtabJour++;
      vusEtabJour[ki.keJ] = true; cleEtabJourPrev = ki.keJ;
      if (ki.kCom) {
        if (ki.kCom !== cleComJourPrev && vusComJour[ki.kCom]) coupesComJour++;
        vusComJour[ki.kCom] = true; cleComJourPrev = ki.kCom;
      }
      if (ki.kzc !== cleZCrenPrev && vusZCren[ki.kzc]) coupesSecteurCren++;
      vusZCren[ki.kzc] = true; cleZCrenPrev = ki.kzc;
      if (ki.kz !== cleZJourPrev && vusZJour[ki.kz]) coupesSecteurJour++;
      vusZJour[ki.kz] = true; cleZJourPrev = ki.kz;
      if (ki.kqc !== cleQCrenPrev && vusQCren[ki.kqc]) coupesQuartierCren++;
      vusQCren[ki.kqc] = true; cleQCrenPrev = ki.kqc;
      if (ki.kq !== cleQJourPrev && vusQJour[ki.kq]) coupesQuartierJour++;
      vusQJour[ki.kq] = true; cleQJourPrev = ki.kq;
    }
    // Priorité absolue : 0 retard (*5000) > ne jamais quitter puis revenir dans une commune (*500) ou un secteur (*300 / *150) >
    // ne pas scinder un établissement (*120 / *100) ou un quartier (*45 / *25) > vraie distance routière (km) + attente
    return {
      retards: nbRetards,
      cout: nbRetards * 5000 + coupesComJour * 500 + coupesSecteurJour * 300 + coupesSecteurCren * 150 + coupesEtab * 120 + coupesEtabJour * 100 + coupesQuartierCren * 45 + coupesQuartierJour * 25 + km + attente / 60
    };
  }
  function coutOrdre(route, depart) {
    var c = coutOrdreBase(route, depart);
    if (depart && route.length) c.cout += 0.2 * (dist(route[route.length - 1], depart) || 0);
    return c;
  }
  function ordonnerItems(items, depart, rapide) {
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
      return c.cout;
    }
    // Construit plusieurs graines rapides avant optimisation locale (et borne initiale du Branch & Bound) :
    // 1. Graine hiérarchique par créneau -> commune -> secteur -> quartier -> établissement ;
    // 2. Graine gloutonne (coût pas-à-pas) ;
    // 3. Graine horaire (échéance la plus serrée d'abord).
    function centreBloc(g) {
      for (var i = 0; i < g.length; i++) if (g[i].coord) return g[i].coord;
      return null;
    }
    function construireGraineCluster() {
      var parCren = { Matin: [], Soir: [] };
      groupes.forEach(function (g, i) {
        parCren[creneauDeItem(g[0]) === 'Soir' ? 'Soir' : 'Matin'].push({
          g: g, idx: i,
          com: cleNorm(typeof communeParente === 'function' ? communeParente(g[0].a.commune) : g[0].a.commune),
          sec: cleZoneSecteur(g[0]), qrt: cleQuartier(g[0]), etab: cleEtablissement(g[0]),
          coord: centreBloc(g),
          tard: g.reduce(function (m, x) { return Math.min(m, x.tard); }, Infinity)
        });
      });
      function chainerCren(blocs, secDepart, comDepart) {
        if (blocs.length < 2) return blocs.map(function (b) { return b.g; });
        var restants = blocs.slice(), out = [];
        var curCom = comDepart || '', curSec = secDepart || '', curQrt = '', curEtab = '';
        var curCoord = depart ? depart.coord : null;
        while (restants.length) {
          var bestI = 0, bestSc = Infinity;
          for (var i = 0; i < restants.length; i++) {
            var b = restants[i];
            var d = curCoord && b.coord ? (distanceKm(curCoord, b.coord) || 0) : 0;
            var sc = d + b.tard * 0.001;
            if (curEtab && b.etab === curEtab) sc -= 500;
            else if (curQrt && b.qrt === curQrt) sc -= 250;
            else if (curSec && b.sec === curSec) sc -= 180;
            else if (curCom && b.com === curCom) sc -= 80;
            if (sc < bestSc) { bestSc = sc; bestI = i; }
          }
          var pick = restants.splice(bestI, 1)[0];
          out.push(pick.g);
          curCom = pick.com; curSec = pick.sec; curQrt = pick.qrt; curEtab = pick.etab;
          if (pick.coord) curCoord = pick.coord;
        }
        return out;
      }
      // Si un secteur (ou une commune) du Matin existe aussi le Soir, le placer en fin de Matin et en début de Soir (0 aller-retour)
      var soirSecs = {}, matinSecs = {}, soirComs = {}, matinComs = {};
      parCren.Soir.forEach(function (b) { soirSecs[b.sec] = true; if (b.com) soirComs[b.com] = true; });
      parCren.Matin.forEach(function (b) { matinSecs[b.sec] = true; if (b.com) matinComs[b.com] = true; });
      var communs = Object.keys(matinSecs).filter(function (s) { return soirSecs[s]; });
      var communsCom = Object.keys(matinComs).filter(function (c) { return soirComs[c]; });
      var mOrdre;
      if (communs.length && parCren.Matin.length > 1) {
        var cBridge = parCren.Matin.filter(function (b) { return b.sec === communs[0]; })[0].com;
        var mSans = cBridge ? parCren.Matin.filter(function (b) { return b.com !== cBridge; }) : parCren.Matin.filter(function (b) { return b.sec !== communs[0]; });
        var mComRest = cBridge ? parCren.Matin.filter(function (b) { return b.com === cBridge && b.sec !== communs[0]; }) : [];
        var mAvec = parCren.Matin.filter(function (b) { return b.sec === communs[0]; });
        mOrdre = chainerCren(mSans, '', '').concat(chainerCren(mComRest, '', cBridge || '')).concat(chainerCren(mAvec, communs[0], cBridge || ''));
      } else if (communsCom.length && parCren.Matin.length > 1) {
        var mSansC = parCren.Matin.filter(function (b) { return b.com !== communsCom[0]; });
        var mAvecC = parCren.Matin.filter(function (b) { return b.com === communsCom[0]; });
        mOrdre = chainerCren(mSansC, '', '').concat(chainerCren(mAvecC, '', communsCom[0]));
      } else {
        mOrdre = chainerCren(parCren.Matin, '', '');
      }
      var finMatin = mOrdre.length ? mOrdre[mOrdre.length - 1][0] : null;
      var sSec = finMatin ? cleZoneSecteur(finMatin) : '';
      var sCom = finMatin ? cleNorm(typeof communeParente === 'function' ? communeParente(finMatin.a.commune) : finMatin.a.commune) : '';
      return mOrdre.concat(chainerCren(parCren.Soir, sSec, sCom));
    }
    var clesMerge = [
      function (g) { return cleEtablissement(g[0]); },
      function (g) { return cleZoneSecteur(g[0]); },
      function (g) { return cleNorm(typeof communeParente === 'function' ? communeParente(g[0].a.commune) : g[0].a.commune); }
    ];
    function optimiserOrdre(ordreInit, maxTours, maxLen) {
      var ordre = ordreInit.slice();
      var coutCur = evaluer(ordre);
      for (var tour = 0, ameliore = true; ameliore && tour < maxTours; tour++) {
        ameliore = false;
        // Fusion directe de segments séparés (aR <-> bR) d'un même établissement, secteur ou commune
        for (var cm = 0; cm < clesMerge.length; cm++) {
          var keyFn = clesMerge[cm], runs = [];
          for (var ri = 0; ri < ordre.length;) {
            var kR = keyFn(ordre[ri]), rj = ri + 1;
            while (rj < ordre.length && keyFn(ordre[rj]) === kR) rj++;
            if (kR) runs.push({ k: kR, deb: ri, fin: rj });
            ri = rj;
          }
          for (var aR = 0; aR < runs.length; aR++) {
            for (var bR = aR + 1; bR < runs.length; bR++) {
              if (runs[aR].k !== runs[bR].k) continue;
              // Option 1 : rapprocher bR de aR ; Option 2 : rapprocher aR de bR
              var segB = ordre.slice(runs[bR].deb, runs[bR].fin);
              var sansB = ordre.slice(0, runs[bR].deb).concat(ordre.slice(runs[bR].fin));
              var segA = ordre.slice(runs[aR].deb, runs[aR].fin);
              var lenA = segA.length;
              var sansA = ordre.slice(0, runs[aR].deb).concat(ordre.slice(runs[aR].fin));
              var essaisM = [
                sansB.slice(0, runs[aR].deb).concat(segB, sansB.slice(runs[aR].deb)),
                sansB.slice(0, runs[aR].fin).concat(segB, sansB.slice(runs[aR].fin)),
                sansA.slice(0, runs[bR].deb - lenA).concat(segA, sansA.slice(runs[bR].deb - lenA)),
                sansA.slice(0, runs[bR].fin - lenA).concat(segA, sansA.slice(runs[bR].fin - lenA))
              ];
              // Option 3 : si d'autres secteurs/communes Matin et Soir s'intercalent entre aR et bR, placer Matin avant et Soir après
              if (cm > 0 && runs[bR].deb > runs[aR].fin) {
                var avantM = ordre.slice(0, runs[aR].deb), interM = [], interS = [], apresM = ordre.slice(runs[bR].fin);
                for (var ik = runs[aR].fin; ik < runs[bR].deb; ik++) {
                  (creneauDeItem(ordre[ik][0]) === 'Soir' ? interS : interM).push(ordre[ik]);
                }
                essaisM.push(avantM.concat(interM, segA, segB, interS, apresM));
                if (avantM.length || apresM.length) essaisM.push(interM.concat(avantM, segA, segB, apresM, interS));
              }
              for (var em = 0; em < essaisM.length; em++) {
                var cM = evaluer(essaisM[em]);
                if (cM < coutCur - 1e-6) { ordre = essaisM[em]; coutCur = cM; ameliore = true; break; }
              }
              if (ameliore) break;
            }
            if (ameliore) break;
          }
        }
        // Or-opt (déplacement de 1 ou 2 blocs contigus)
        for (var len = 1; len <= maxLen; len++) {
          for (var a = 0; a + len <= ordre.length; a++) {
            var seg = ordre.slice(a, a + len), sans = ordre.slice(0, a).concat(ordre.slice(a + len));
            for (var p = 0; p <= sans.length; p++) {
              if (p === a) continue;
              var essai2 = sans.slice(0, p).concat(seg, sans.slice(p));
              var c2 = evaluer(essai2);
              if (c2 < coutCur - 1e-6) { ordre = essai2; coutCur = c2; ameliore = true; break; }
            }
            if (ameliore) break;
          }
        }
        // 2-opt
        for (var i = 0; i < ordre.length - 1; i++) {
          for (var j = i + 1; j < ordre.length; j++) {
            var essai = ordre.slice(0, i).concat(ordre.slice(i, j + 1).reverse(), ordre.slice(j + 1));
            var c1 = evaluer(essai);
            if (c1 < coutCur - 1e-6) { ordre = essai; coutCur = c1; ameliore = true; }
          }
        }
      }
    }
    optimiserOrdre(construireGraineCluster(), rapide ? 3 : 14, rapide ? 1 : 2);
    if (!rapide) {
      var resteGl = groupes.slice(), ordreGl = [];
      while (resteGl.length) {
        var meilleurGl = null;
        resteGl.forEach(function (g, i) {
          var c = coutOrdre(aplatir(ordreGl.concat([g])), depart);
          if (!meilleurGl || c.cout < meilleurGl.c) meilleurGl = { c: c.cout, i: i };
        });
        ordreGl.push(resteGl.splice(meilleurGl.i, 1)[0]);
      }
      optimiserOrdre(ordreGl, 14, 2);
      var ordreHor = groupes.slice().sort(function (ga, gb) {
        return ga[0].tard - gb[0].tard || cleZoneSecteur(ga[0]).localeCompare(cleZoneSecteur(gb[0]));
      });
      optimiserOrdre(ordreHor, 10, 2);
    }
    if (!rapide && groupes.length <= 9) {
      var noeudsBb = 0, MAX_NOEUDS_BB = 2500;
      (function permuter(reste, pris) {
        if (noeudsBb > MAX_NOEUDS_BB) return;
        if (!reste.length) { evaluer(pris); return; }
        if (best && pris.length >= 2) {
          noeudsBb++;
          var lb = coutOrdreBase(aplatir(pris, true), depart);
          if (lb.cout >= best.c.cout - 1e-6) return;   // Branch & Bound : borne inférieure admissible monotone
        }
        for (var i = 0; i < reste.length; i++) {
          if (noeudsBb > MAX_NOEUDS_BB) return;
          permuter(reste.slice(0, i).concat(reste.slice(i + 1)), pris.concat([reste[i]]));
        }
      })(groupes, []);
    }
    return best ? best.r : aplatir([libres]);
  }
  // Ordre retenu : le regroupement par établissement, sauf s'il crée plus de retards que l'ordre d'origine
  function meilleurOrdre(route, depart, rapide) {
    if (route.length < 2) return route;
    var nouveau = ordonnerItems(route, depart, rapide);
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
  // 3.31.101 : résultat mémorisé (appelée pour chaque lieu à la préparation de la base et à chaque calcul de tournée)
  var _cleNormCache = Object.create(null), _cleNormN = 0;
  function cleNorm(x) {
    var t = String(x || ''), v = _cleNormCache[t];
    if (v !== undefined) return v;
    if (++_cleNormN > 20000) { _cleNormCache = Object.create(null); _cleNormN = 0; }
    return (_cleNormCache[t] = t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ''));
  }
  function cleEtablissement(it) { var a = it.a; return cleNorm(a.lieu) ? cleNorm(a.lieu) + '|' + cleNorm(a.commune) : 'u|' + (a.uid || a.code); }
  // 3.28.26 : dans un même hôpital, les médecins d'une même spécialité se suivent
  function cleLieuSpec(it) { return cleEtablissement(it) + '|' + cleNorm(it.a.specialite || it.a.type); }
  // 3.28.22 : quartier ramené à son nom principal : « Anador », « Abobo Anador » et « Anador Sogefiha » vont ensemble ;
  // le nom de la commune n'est retiré que s'il est un mot séparé (« Aboboté » reste « Aboboté »)
  function normaliserSynonymeSecteur(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\b(ii|2)\s*plateaux\b/g, 'deuxplateaux')
      .replace(/\bdeux\s+plateaux\b/g, 'deuxplateaux');
  }
  function cleSecteur(quartier, commune) {
    var mots = normaliserSynonymeSecteur(quartier).split(/[^a-z0-9]+/).filter(Boolean);
    var com = String(commune || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
    var vides = { de: 1, du: 1, des: 1, la: 1, le: 1, les: 1, quartier: 1, cite: 1, zone: 1, sous: 1, prefecture: 1 };
    var reste = mots.filter(function (w) { return com.indexOf(w) < 0 && !vides[w] && w.length >= 3; });
    if (!reste.length) return mots.join('');   // « Cocody Centre », « Plateau » : le nom entier
    return reste[0] === 'centre' ? mots.join('') : reste[0];
  }
  function cleQuartier(it) {
    var a = it.a || it;
    var comBase = typeof communeParente === 'function' ? communeParente(a.commune) : a.commune;
    var qRef = a.quartier || a.secteur || '';
    if (a.secteur && cleNorm(a.quartier) === cleNorm(comBase)) qRef = a.secteur;
    var k = cleSecteur(qRef, comBase);
    return k ? k + '|' + cleNorm(comBase) : cleEtablissement(it);
  }
  // 3.31.58 : secteur = SUBDIVISION de l'onglet Quartiers (Cocody – Angré, Cocody – Riviera, Abobo – Sud…), retrouvée
  // depuis la commune et le quartier de l'arrêt : 8e Tranche, Djibi, Château, Oscar → Angré ; Palmeraie, Bonoumin,
  // Riviera Golf → Riviera ; Vallons, Latrille → Deux Plateaux ; Blockhauss, Danga, Mermoz → Cocody – Centre.
  // Un quartier homonyme d'une autre commune (Djibi d'Abobo, Sideci de Yopougon) reste dans sa commune.
  // Communes sans subdivision (Marcory, Adjamé, Plateau…) : comme avant (grands secteurs de Marcory, sinon le quartier).
  var QUARTIERS_MOTEUR = null, CACHE_CLE_Z = {}, SUBS_PAR_COM = {};
  function definirQuartiersMoteur(l) { if (l !== QUARTIERS_MOTEUR) { QUARTIERS_MOTEUR = l && l.length ? l : null; CACHE_CLE_Z = {}; SUBS_PAR_COM = {}; } if (l && l.length && typeof definirQuartiersCourants === 'function') definirQuartiersCourants(l); }
  function resoudreSub_(commune, quartier, secteur) {
    try {
      // règle unique (commun.js) : quartier connu, quartier qui nomme une subdivision (« Deux Plateaux », « Riviera »)
      if (typeof territoireDuLieu === 'function' && quartier) {
        var tl = territoireDuLieu(commune || '', quartier, QUARTIERS_MOTEUR || undefined);
        if (tl && tl.subdivision) return { sub: tl.subdivision, com: tl.commune || '' };
      }
      var t = resoudreTerritoire({ commune: commune || '', quartier: quartier || '', secteur: secteur || '', subdivision: '', lieu: '' }, QUARTIERS_MOTEUR || undefined);
      if (t && t.matched && t.subdivision) return { sub: t.subdivision, com: t.commune || '' };
    } catch (e) {}
    return null;
  }
  function subdivisionDe(a) {
    var cle = [a.commune, a.quartier, a.secteur].map(cleNorm).join('|');
    if (CACHE_CLE_Z[cle] !== undefined) return CACHE_CLE_Z[cle];
    var r = null;
    if (typeof resoudreTerritoire === 'function' && (a.quartier || a.secteur)) {
      r = resoudreSub_(a.commune, a.quartier, a.secteur);
      // pluriel ou singulier écrit autrement que dans l'onglet (« Oscars » / « Oscar », « Vallon » / « Vallons »)
      var q = String(a.quartier || '').trim();
      if (!r && q) r = resoudreSub_(a.commune, /s$/i.test(q) ? q.slice(0, -1) : q + 's', '');
    }
    CACHE_CLE_Z[cle] = r;
    return r;
  }
  // Subdivisions dynamiques d'une commune (lues depuis l'onglet Quartiers, jamais codées en dur)
  function subdivisionsMoteur(comBase) {
    var kc = cleNorm(comBase);
    if (!kc) return [];
    if (SUBS_PAR_COM[kc]) return SUBS_PAR_COM[kc];
    var l = QUARTIERS_MOTEUR || (typeof quartiersDefautObjets === 'function' ? quartiersDefautObjets() : []);
    var vus = {}, out = [];
    for (var i = 0; i < l.length; i++) {
      var q = l[i]; if (!q || !q.subdivision) continue;
      if (cleNorm(communeParente(q.commune)) !== kc) continue;
      var kSub = cleNorm(q.subdivision);
      if (!kSub || vus[kSub]) continue;
      vus[kSub] = true;
      var motsSub = normaliserSynonymeSecteur(q.subdivision).replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/).filter(function (w) {
        return w && w.length >= 3 && w !== kc && w !== 'centre';
      });
      var motCompact = motsSub.join('');
      out.push({ nom: q.subdivision, cle: kSub, mot: motCompact || kSub, mots: motsSub });
    }
    SUBS_PAR_COM[kc] = out;
    return out;
  }
  function cleZoneSecteur(it) {
    var a = it.a || it;
    var comBase = typeof communeParente === 'function' ? communeParente(a.commune) : a.commune;
    // le quartier fait foi (onglet Quartiers) ; la subdivision portée par l'arrêt sert si le quartier est inconnu
    var r = subdivisionDe(a);
    var sub = (r && r.sub) || a.subdivision || '';
    if (sub) return 'sub:' + cleNorm(sub) + '|' + cleNorm(communeParente((r && r.com) || comBase) || comBase);
    var tout = normaliserSynonymeSecteur([a.secteur, a.quartier].filter(Boolean).join(' '));
    var toutCompact = tout.replace(/[^a-z0-9]+/g, '');
    // quartier absent de l'onglet Quartiers : comparaison dynamique aux subdivisions actuelles de la commune
    var subsCom = subdivisionsMoteur(comBase);
    for (var i = 0; i < subsCom.length; i++) {
      var sItem = subsCom[i];
      if (sItem.mot && sItem.mot.length >= 4 && toutCompact.indexOf(sItem.mot) >= 0) {
        return 'sub:' + sItem.cle + '|' + cleNorm(comBase);
      }
      for (var mi = 0; mi < sItem.mots.length; mi++) {
        if (sItem.mots[mi].length >= 4 && new RegExp('\\b' + sItem.mots[mi] + '\\b').test(tout)) {
          return 'sub:' + sItem.cle + '|' + cleNorm(comBase);
        }
      }
    }
    var sRef = a.quartier || a.secteur || '';
    if (a.secteur && cleNorm(sRef) === cleNorm(comBase)) sRef = a.secteur;
    var k = cleSecteur(sRef, comBase);
    return k ? k + '|' + cleNorm(comBase) : cleQuartier(it);
  }
  // 3.28.23 : secteur de la tournée : subdivision issue de Quartiers (sinon sous-secteur des grandes communes, sinon commune)
  function nomSecteurTournee(a, quartiers) {
    if (!a) return '';
    // 3.31.61 : la subdivision vient de l'onglet Quartiers au moment de l'affichage (nom renommé, créé ou supprimé
    // pris en compte, même pour une tournée enregistrée avant le changement)
    if (typeof territoireDuLieu === 'function' && (a.quartier || a.secteur)) {
      var lq = (quartiers && quartiers.length) ? quartiers : (QUARTIERS_MOTEUR || undefined);
      var tl = territoireDuLieu(a.commune || '', a.quartier || a.secteur, lq);
      if (tl && tl.subdivision) return tl.subdivision;
    }
    // subdivision portée par l'arrêt : seulement si elle existe encore dans l'onglet
    var lqs = (quartiers && quartiers.length) ? quartiers : QUARTIERS_MOTEUR;
    if (a.subdivision && (!lqs || lqs.some(function (q) { return q && bas(q.subdivision) === bas(a.subdivision); }))) return a.subdivision;
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
      var rT = resoudreTerritoire(Object.assign({}, a, { subdivision: '' }), quartiers);
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

  // Rééquilibrage et consolidation post-sélection :
  // 1. Regroupe les praticiens d'un même secteur/quartier sur la même demi-journée (par échange Matin/Soir ou bascule)
  //    dès lors que leurs horaires de réception le permettent sans retard ;
  // 2. Équilibre Matin/Soir sans jamais scinder un secteur en aller-retour.
  function estArretFlexible(it) {
    var a = it.a;
    return !(it.fixe || a.impose || a.garde || a.rdv || a.statut || a.etat === 'valide');
  }
  function altCreneauPour(candsParCode, it, cibleCren) {
    var a = it.a;
    return (candsParCode[a.code] || []).filter(function (cd) { return cd.a.creneau === cibleCren; })
      .sort(function (x, y) { return (x.a.idPresence === a.idPresence ? 0 : 1) - (y.a.idPresence === a.idPresence ? 0 : 1); })[0] || null;
  }
  function equilibrerCreneaux(route, cands, depart, targetMatin, targetSoir) {
    var totalCible = targetMatin + targetSoir;
    var tM = route.length < totalCible ? Math.ceil(route.length / 2) : targetMatin;
    var tS = route.length < totalCible ? route.length - tM : targetSoir;
    var candsParCode = {};
    for (var ci = 0; ci < cands.length; ci++) {
      var cc = cands[ci], codeC = cc.a.code;
      (candsParCode[codeC] = candsParCode[codeC] || []).push(cc);
    }
    // 1. Équilibrage de charge Matin / Soir tant que cela ne crée aucune coupure de secteur/quartier
    for (var step = 0; step < route.length; step++) {
      var curM = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
      var curS = route.length - curM;
      var sur = curM > tM + (curS < tS ? 0 : 1) ? 'Matin' : (curS > tS + (curM < tM ? 0 : 1) ? 'Soir' : '');
      if (!sur) break;
      var cibleCren = sur === 'Matin' ? 'Soir' : 'Matin';
      var refCost = coutOrdre(route, depart);
      var meilleur = null;
      for (var i = 0; i < route.length; i++) {
        var it = route[i];
        if (!estArretFlexible(it) || creneauDeItem(it) !== sur) continue;
        var alt = altCreneauPour(candsParCode, it, cibleCren);
        if (!alt) continue;
        var essai = route.slice();
        essai[i] = alt.it;
        essai = meilleurOrdre(essai, depart, true);
        var c = coutOrdre(essai, depart);
        if (c.retards <= refCost.retards && c.cout <= refCost.cout + 10) {
          if (!meilleur || c.cout < meilleur.cost) meilleur = { route: essai, cost: c.cout };
        }
      }
      if (!meilleur) break;
      route = meilleur.route;
    }
    // 2. Consolidation de zone : échange Matin <-> Soir entre deux praticiens ou bascule d'un praticien isolé
    //    si cela élimine un aller-retour entre secteurs/quartiers sans créer de retard
    for (var passe = 0; passe < route.length; passe++) {
      var seenRoute = { com: {}, sec: {}, qrt: {}, etab: {} }, cutsFound = false;
      var prevRoute = { com: null, sec: null, qrt: null, etab: null };
      var cntAll = { com: {}, sec: {}, qrt: {}, etab: {} };
      for (var r0 = 0; r0 < route.length; r0++) {
        var rt0 = route[r0];
        var kCom0 = cleNorm(typeof communeParente === 'function' ? communeParente(rt0.a.commune) : rt0.a.commune);
        var kSec0 = cleZoneSecteur(rt0), kQrt0 = cleQuartier(rt0), kEt0 = cleEtablissement(rt0);
        if (kCom0) cntAll.com[kCom0] = true;
        if (kSec0) cntAll.sec[kSec0] = true;
        if (kQrt0) cntAll.qrt[kQrt0] = true;
        if (kEt0) cntAll.etab[kEt0] = true;
        if (kCom0 && kCom0 !== prevRoute.com && seenRoute.com[kCom0]) cutsFound = true;
        if (kSec0 && kSec0 !== prevRoute.sec && seenRoute.sec[kSec0]) cutsFound = true;
        if (kQrt0 && kQrt0 !== prevRoute.qrt && seenRoute.qrt[kQrt0]) cutsFound = true;
        if (kEt0 && kEt0 !== prevRoute.etab && seenRoute.etab[kEt0]) cutsFound = true;
        if (kCom0) seenRoute.com[kCom0] = true; prevRoute.com = kCom0;
        if (kSec0) seenRoute.sec[kSec0] = true; prevRoute.sec = kSec0;
        if (kQrt0) seenRoute.qrt[kQrt0] = true; prevRoute.qrt = kQrt0;
        if (kEt0) seenRoute.etab[kEt0] = true; prevRoute.etab = kEt0;
      }
      if (!cutsFound) break;
      var multiC = Object.keys(cntAll.com).length > 1;
      var multiS = Object.keys(cntAll.sec).length > 1;
      var multiQ = Object.keys(cntAll.qrt).length > 1;
      var multiE = Object.keys(cntAll.etab).length > 1;
      var baseCost = coutOrdre(route, depart);
      var comCren = { Matin: {}, Soir: {} }, secCren = { Matin: {}, Soir: {} }, qrtCren = { Matin: {}, Soir: {} }, etabCren = { Matin: {}, Soir: {} };
      for (var ri = 0; ri < route.length; ri++) {
        var rt = route[ri], crR = creneauDeItem(rt);
        var kcR = cleNorm(typeof communeParente === 'function' ? communeParente(rt.a.commune) : rt.a.commune);
        if (kcR) comCren[crR][kcR] = true;
        secCren[crR][cleZoneSecteur(rt)] = true;
        qrtCren[crR][cleQuartier(rt)] = true;
        etabCren[crR][cleEtablissement(rt)] = true;
      }
      var bestSwap = null;
      // 2a. Échange 1-pour-1 entre un arrêt du Matin et un arrêt du Soir
      for (var i2 = 0; i2 < route.length; i2++) {
        var itA = route[i2];
        if (!estArretFlexible(itA)) continue;
        var crA = creneauDeItem(itA), autreA = crA === 'Matin' ? 'Soir' : 'Matin';
        var altA = altCreneauPour(candsParCode, itA, autreA);
        if (!altA) continue;
        var cA = cleNorm(typeof communeParente === 'function' ? communeParente(itA.a.commune) : itA.a.commune);
        var sA = cleZoneSecteur(itA), qA = cleQuartier(itA), eA = cleEtablissement(itA);
        var matchA = (multiC && comCren[autreA][cA]) || (multiS && secCren[autreA][sA]) || (multiQ && qrtCren[autreA][qA]) || (multiE && etabCren[autreA][eA]);
        for (var j2 = i2 + 1; j2 < route.length; j2++) {
          var itB = route[j2];
          if (!estArretFlexible(itB)) continue;
          var crB = creneauDeItem(itB);
          if (crA === crB) continue;
          var cB = cleNorm(typeof communeParente === 'function' ? communeParente(itB.a.commune) : itB.a.commune);
          var sB = cleZoneSecteur(itB), qB = cleQuartier(itB), eB = cleEtablissement(itB);
          if (sA === sB && qA === qB) continue;
          var matchB = (multiC && comCren[crA][cB]) || (multiS && secCren[crA][sB]) || (multiQ && qrtCren[crA][qB]) || (multiE && etabCren[crA][eB]);
          if (!matchA && !matchB) continue;
          var altB = altCreneauPour(candsParCode, itB, crA);
          if (!altB) continue;
          var essaiSwap = route.slice();
          essaiSwap[i2] = altA.it;
          essaiSwap[j2] = altB.it;
          essaiSwap = meilleurOrdre(essaiSwap, depart, true);
          var cSwap = coutOrdre(essaiSwap, depart);
          if (cSwap.retards <= baseCost.retards && cSwap.cout < baseCost.cout - 1) {
            if (!bestSwap || cSwap.cout < bestSwap.cost) bestSwap = { route: essaiSwap, cost: cSwap.cout };
          }
        }
      }
      // 2b. Bascule d'un praticien vers la demi-journée où se trouvent déjà les autres médecins de son secteur
      for (var i3 = 0; i3 < route.length; i3++) {
        var itM = route[i3];
        if (!estArretFlexible(itM)) continue;
        var crM = creneauDeItem(itM), cibleM = crM === 'Matin' ? 'Soir' : 'Matin';
        var kcM = cleNorm(typeof communeParente === 'function' ? communeParente(itM.a.commune) : itM.a.commune);
        if (!((multiC && comCren[cibleM][kcM]) || (multiS && secCren[cibleM][cleZoneSecteur(itM)]) || (multiQ && qrtCren[cibleM][cleQuartier(itM)]) || (multiE && etabCren[cibleM][cleEtablissement(itM)]))) continue;
        var altM = altCreneauPour(candsParCode, itM, cibleM);
        if (!altM) continue;
        var essaiMove = route.slice();
        essaiMove[i3] = altM.it;
        essaiMove = meilleurOrdre(essaiMove, depart, true);
        var cMove = coutOrdre(essaiMove, depart);
        // Uniquement si le gain couvre au moins une coupure de quartier/secteur (>= 20 pts) sans aucun retard
        if (cMove.retards <= baseCost.retards && cMove.cout < baseCost.cout - 20) {
          if (!bestSwap || cMove.cout < bestSwap.cost) bestSwap = { route: essaiMove, cost: cMove.cout };
        }
      }
      if (!bestSwap) break;
      route = bestSwap.route;
    }
    return route;
  }

  function filtrerFixesJour(rawFixes, maxFixes) {
    var faitsFixes = rawFixes.filter(function (a) { return !!a.statut; });
    var priosFixes = rawFixes.filter(function (a) { return !a.statut && (a.impose || a.etape || a.rdv); });
    var planFixes = rawFixes.filter(function (a) { return !a.statut && !(a.impose || a.etape || a.rdv); });
    if (planFixes.length > Math.max(0, maxFixes - faitsFixes.length)) {
      planFixes.sort(function (a, b) {
        var ga = a.garde ? 0 : 1;
        var gb = b.garde ? 0 : 1;
        if (ga !== gb) return ga - gb;
        if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
        return item(a).tot - item(b).tot;
      });
      planFixes = planFixes.slice(0, Math.max(0, maxFixes - faitsFixes.length));
    }
    return faitsFixes.concat(priosFixes).concat(planFixes);
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
      var rv = o.rejetes && o.rejetes[c.code];
      var nbVus = rv === true ? 9999 : (+rv || 0);
      return { a: a, it: item(a), score: a.score * (0.5 + 0.5 * a.fiab), rejete: nbVus > 0, nbVus: nbVus };
    });

    // Pré-calcul unique par immeuble des clés quartier/secteur/établissement (évite de rescanner 472 quartiers à chaque étape)
    var cleQImm = {}, cleZImm = {};
    cands.forEach(function (cd) {
      var ki = cd.a.cleImmeuble || cd.a.code;
      if (cleQImm[ki] === undefined) {
        cleQImm[ki] = cleQuartier(cd.it);
        cleZImm[ki] = cleZoneSecteur(cd.it);
      }
      cd.cleQ = cleQImm[ki];
      cd.cleZ = cleZImm[ki];
      cd.cleE = cleEtablissement(cd.it);
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

    var nbPrios = fixesGardes.filter(function (a) { return !a.statut && (a.impose || a.etape || a.rdv); }).length;
    var baseCible = Math.min(max, o.targetJour !== undefined && o.targetJour !== null ? o.targetJour : max);
    var cibleJour = Math.max(route.length, baseCible + nbPrios);
    var targetMatin = Math.ceil(cibleJour / 2), targetSoir = cibleJour - targetMatin;

    // Répartition équitable par commune puis par subdivision/secteur :
    // - Si une commune à subdivisions est ciblée (ex. Cocody = 4 subdivisions), les visites du jour sont réparties
    //   équitablement entre ses subdivisions (ex. 10 -> 3+3+2+2) ;
    // - Si plusieurs communes sont sélectionnées (ex. Cocody + Plateau), répartition équitable d'abord par commune,
    //   puis par subdivision dans chaque commune ;
    // - Rotation des +1 restants d'un jour à l'autre (semaine) et d'un recalcul à l'autre (rejetes).
    var joursSecteur = o.joursSecteur || {}, visitesSecteur = o.visitesSecteur || {};
    var aSecteursSemaine = Object.keys(joursSecteur).length > 0;
    var rejSecteur = {}, aRejSecteur = false, vusRejCode = {};
    var partComMap = {}, partsParCom = {}, codesUniqPart = {}, capPart = {}, scorePart = {}, hasSubCom = {};
    cands.forEach(function (cd) {
      var comNom = typeof communeParente === 'function' ? communeParente(cd.a.commune) : cd.a.commune;
      var kCom = cleNorm(comNom) || 'autre';
      var subsCom = subdivisionsMoteur(comNom);
      var kPart = (subsCom.length && cd.cleZ.indexOf('sub:') === 0) ? cd.cleZ
        : (subsCom.length ? 'comgen:' + kCom : 'com:' + kCom);
      cd.cleCom = kCom;
      cd.clePart = kPart;
      partComMap[kPart] = kCom;
      if (kPart.indexOf('sub:') === 0) hasSubCom[kCom] = true;
      (partsParCom[kCom] = partsParCom[kCom] || {})[kPart] = true;
      if (!codesUniqPart[kPart]) codesUniqPart[kPart] = {};
      if (!codesUniqPart[kPart][cd.a.code]) {
        codesUniqPart[kPart][cd.a.code] = true;
        capPart[kPart] = (capPart[kPart] || 0) + 1;
      }
      if (scorePart[kPart] === undefined || cd.score > scorePart[kPart]) scorePart[kPart] = cd.score;
      if (cd.nbVus > 0 && !vusRejCode[cd.a.code]) {
        vusRejCode[cd.a.code] = true;
        rejSecteur[cd.cleZ] = (rejSecteur[cd.cleZ] || 0) + 1;
        aRejSecteur = true;
      }
    });
    function clePartArret(it) {
      var comNom = typeof communeParente === 'function' ? communeParente(it.a.commune) : it.a.commune;
      var kCom = cleNorm(comNom) || 'autre';
      var subsCom = subdivisionsMoteur(comNom);
      var kz = cleZoneSecteur(it);
      if (subsCom.length && kz.indexOf('sub:') === 0) return kz;
      if (subsCom.length) return hasSubCom[kCom] && !partsParCom[kCom]['comgen:' + kCom] ? 'sub:' + subsCom[0].cle + '|' + kCom : 'comgen:' + kCom;
      return 'com:' + kCom;
    }
    var nonPrioFixPart = {}, prioFixPart = {}, nonPrioFixCom = {}, capTotPart = {}, rejPart = {}, semVisPart = {};
    Object.keys(capPart).forEach(function (k) { capTotPart[k] = capPart[k]; });
    route.forEach(function (it) {
      var kP = clePartArret(it), kC = partComMap[kP] || cleNorm(typeof communeParente === 'function' ? communeParente(it.a.commune) : it.a.commune) || 'autre';
      partComMap[kP] = kC;
      var estPrio = !it.a.statut && (it.a.impose || it.a.etape || it.a.rdv);
      if (estPrio) prioFixPart[kP] = (prioFixPart[kP] || 0) + 1;
      else {
        nonPrioFixPart[kP] = (nonPrioFixPart[kP] || 0) + 1;
        nonPrioFixCom[kC] = (nonPrioFixCom[kC] || 0) + 1;
        capTotPart[kP] = (capTotPart[kP] || 0) + 1;
      }
    });
    Object.keys(rejSecteur).forEach(function (kz) { rejPart[kz] = (rejPart[kz] || 0) + rejSecteur[kz]; });
    Object.keys(visitesSecteur).forEach(function (kz) { semVisPart[kz] = (semVisPart[kz] || 0) + visitesSecteur[kz]; });

    // 1) Répartition équitable au niveau des communes sélectionnées
    var quotaCom = {}, capCom = {}, listeComs = Object.keys(partsParCom);
    listeComs.forEach(function (kC) {
      quotaCom[kC] = nonPrioFixCom[kC] || 0;
      var codesC = {};
      Object.keys(partsParCom[kC]).forEach(function (kP) {
        if (codesUniqPart[kP]) Object.keys(codesUniqPart[kP]).forEach(function (c) { codesC[c] = true; });
      });
      capCom[kC] = (nonPrioFixCom[kC] || 0) + Object.keys(codesC).length;
    });
    var cibleReg = Math.max(0, cibleJour - nbPrios);
    var totalNonPrioFix = Object.keys(nonPrioFixCom).reduce(function (s, k) { return s + nonPrioFixCom[k]; }, 0);
    var aRepCom = Math.max(0, cibleReg - totalNonPrioFix);
    var ordreComs = listeComs.slice().sort(function (a, b) {
      var sa = Object.keys(partsParCom[a]).reduce(function (t, p) { return t + (semVisPart[p] || 0); }, 0);
      var sb = Object.keys(partsParCom[b]).reduce(function (t, p) { return t + (semVisPart[p] || 0); }, 0);
      var ra = Object.keys(partsParCom[a]).reduce(function (t, p) { return t + (rejPart[p] || 0); }, 0);
      var rb = Object.keys(partsParCom[b]).reduce(function (t, p) { return t + (rejPart[p] || 0); }, 0);
      return sa - sb || ra - rb || capCom[b] - capCom[a];
    });
    for (var progC = true; aRepCom > 0 && progC;) {
      progC = false;
      ordreComs.sort(function (a, b) {
        var sa = Object.keys(partsParCom[a]).reduce(function (t, p) { return t + (semVisPart[p] || 0); }, 0);
        var sb = Object.keys(partsParCom[b]).reduce(function (t, p) { return t + (semVisPart[p] || 0); }, 0);
        return quotaCom[a] - quotaCom[b] || sa - sb || capCom[b] - capCom[a];
      });
      for (var ciC = 0; ciC < ordreComs.length && aRepCom > 0; ciC++) {
        var kc = ordreComs[ciC];
        if (quotaCom[kc] < capCom[kc]) { quotaCom[kc]++; aRepCom--; progC = true; }
      }
    }

    // 2) Répartition équitable entre subdivisions au sein de chaque commune (+ surplus prios)
    var quotaPart = {};
    Object.keys(nonPrioFixPart).forEach(function (kP) { quotaPart[kP] = nonPrioFixPart[kP]; });
    listeComs.forEach(function (kC) {
      var partsC = Object.keys(partsParCom[kC]);
      if (hasSubCom[kC]) partsC = partsC.filter(function (p) { return p.indexOf('sub:') === 0; });
      if (!partsC.length) partsC = Object.keys(partsParCom[kC]);
      partsC.forEach(function (kP) { if (quotaPart[kP] === undefined) quotaPart[kP] = nonPrioFixPart[kP] || 0; });
      var dejaC = partsC.reduce(function (t, kP) { return t + quotaPart[kP]; }, 0);
      var aRepP = Math.max(0, (quotaCom[kC] || 0) - dejaC);
      for (var progP = true; aRepP > 0 && progP;) {
        progP = false;
        partsC.sort(function (a, b) {
          return quotaPart[a] - quotaPart[b] ||
            (semVisPart[a] || 0) - (semVisPart[b] || 0) ||
            (rejPart[a] || 0) - (rejPart[b] || 0) ||
            (scorePart[b] || 0) - (scorePart[a] || 0);
        });
        for (var piP = 0; piP < partsC.length && aRepP > 0; piP++) {
          var kp = partsC[piP];
          if (quotaPart[kp] < (capTotPart[kp] || 0)) { quotaPart[kp]++; aRepP--; progP = true; }
        }
      }
      // Si une subdivision n'avait plus de capacité, reverser le reste dans d'éventuels praticiens génériques de la commune
      if (aRepP > 0) {
        Object.keys(partsParCom[kC]).forEach(function (kP) {
          if (quotaPart[kP] === undefined) quotaPart[kP] = nonPrioFixPart[kP] || 0;
          var dispo = (capTotPart[kP] || 0) - quotaPart[kP];
          if (dispo > 0 && aRepP > 0) { var add = Math.min(dispo, aRepP); quotaPart[kP] += add; aRepP -= add; }
        });
      }
    });
    Object.keys(prioFixPart).forEach(function (kP) { quotaPart[kP] = (quotaPart[kP] || 0) + prioFixPart[kP]; });

    // 3) Attribution demi-journée (Matin / Soir / Pont 12:30) par commune et subdivision :
    // garantit que chaque commune et chaque secteur n'apparaît qu'une seule fois dans la tournée.
    var capMatPart = {}, capSoiPart = {}, fixMatPart = {}, fixSoiPart = {};
    var vusMatCode = {}, vusSoiCode = {};
    cands.forEach(function (cd) {
      if (cd.nbVus > 0) return;
      var kp = cd.clePart, cr = creneauDeItem(cd.it);
      if (cr === 'Matin') {
        if (!(vusMatCode[kp] && vusMatCode[kp][cd.a.code])) {
          (vusMatCode[kp] = vusMatCode[kp] || {})[cd.a.code] = true;
          capMatPart[kp] = (capMatPart[kp] || 0) + 1;
        }
      } else {
        if (!(vusSoiCode[kp] && vusSoiCode[kp][cd.a.code])) {
          (vusSoiCode[kp] = vusSoiCode[kp] || {})[cd.a.code] = true;
          capSoiPart[kp] = (capSoiPart[kp] || 0) + 1;
        }
      }
    });
    route.forEach(function (it) {
      var kp = clePartArret(it);
      if (creneauDeItem(it) === 'Matin') {
        fixMatPart[kp] = (fixMatPart[kp] || 0) + 1;
        capMatPart[kp] = (capMatPart[kp] || 0) + 1;
      } else {
        fixSoiPart[kp] = (fixSoiPart[kp] || 0) + 1;
        capSoiPart[kp] = (capSoiPart[kp] || 0) + 1;
      }
    });
    var crenPart = {}, targetMatinPlan = targetMatin, targetSoirPlan = targetSoir;
    var activeParts = Object.keys(quotaPart).filter(function (kP) { return quotaPart[kP] > 0; });
    if (activeParts.length > 1) {
      // Construire des chaînes ordonnées commune par commune, en explorant les ordres de communes et frontières possibles
      var parComOrdre = {};
      activeParts.forEach(function (kP) {
        var kc = partComMap[kP] || 'autre';
        (parComOrdre[kc] = parComOrdre[kc] || []).push(kP);
      });
      var totalP = activeParts.reduce(function (s, kP) { return s + quotaPart[kP]; }, 0);
      var comsKeys = Object.keys(parComOrdre);
      var trierLp = function (lpRaw) {
        return lpRaw.slice().sort(function (a, b) {
          var qA = quotaPart[a], qB = quotaPart[b];
          var fa = (fixMatPart[a] || 0) - (fixSoiPart[a] || 0);
          var fb = (fixMatPart[b] || 0) - (fixSoiPart[b] || 0);
          if (fa !== fb) return fb - fa;
          var onlyMatA = (capSoiPart[a] || 0) < qA ? -1 : ((capMatPart[a] || 0) < qA ? 1 : 0);
          var onlyMatB = (capSoiPart[b] || 0) < qB ? -1 : ((capMatPart[b] || 0) < qB ? 1 : 0);
          if (onlyMatA !== onlyMatB) return onlyMatA - onlyMatB;
          var mustPontA = (capMatPart[a] || 0) < qA && (capSoiPart[a] || 0) < qA ? 1 : 0;
          var mustPontB = (capMatPart[b] || 0) < qB && (capSoiPart[b] || 0) < qB ? 1 : 0;
          if (mustPontA !== mustPontB) return mustPontA - mustPontB;
          return ((capMatPart[b] || 0) - (capSoiPart[b] || 0)) - ((capMatPart[a] || 0) - (capSoiPart[a] || 0));
        });
      };
      var permsDe = function (arr) {
        var out = [];
        (function gen(rest, acc) {
          if (!rest.length) { out.push(acc); return; }
          for (var i = 0; i < rest.length; i++) gen(rest.slice(0, i).concat(rest.slice(i + 1)), acc.concat([rest[i]]));
        })(arr, []);
        return out;
      };
      var comsTriees = comsKeys.slice().sort(function (a, b) {
        var oMa = parComOrdre[a].some(function (p) { return (capSoiPart[p] || 0) < quotaPart[p]; }) ? 1 : 0;
        var oMb = parComOrdre[b].some(function (p) { return (capSoiPart[p] || 0) < quotaPart[p]; }) ? 1 : 0;
        var oSa = parComOrdre[a].some(function (p) { return (capMatPart[p] || 0) < quotaPart[p]; }) ? 1 : 0;
        var oSb = parComOrdre[b].some(function (p) { return (capMatPart[p] || 0) < quotaPart[p]; }) ? 1 : 0;
        if ((oMa - oSa) !== (oMb - oSb)) return (oMb - oSb) - (oMa - oSa);
        var fMa = parComOrdre[a].reduce(function (s, p) { return s + (fixMatPart[p] || 0); }, 0);
        var fMb = parComOrdre[b].reduce(function (s, p) { return s + (fixMatPart[p] || 0); }, 0);
        var fSa = parComOrdre[a].reduce(function (s, p) { return s + (fixSoiPart[p] || 0); }, 0);
        var fSb = parComOrdre[b].reduce(function (s, p) { return s + (fixSoiPart[p] || 0); }, 0);
        if ((fMa > 0) !== (fMb > 0)) return fMa > 0 ? -1 : 1;
        if ((fSa > 0) !== (fSb > 0)) return fSa > 0 ? 1 : -1;
        var mRa = parComOrdre[a].reduce(function (s, p) { return s + (capMatPart[p] || 0) - (capSoiPart[p] || 0); }, 0);
        var mRb = parComOrdre[b].reduce(function (s, p) { return s + (capMatPart[p] || 0) - (capSoiPart[p] || 0); }, 0);
        return mRb - mRa || (a < b ? -1 : 1);
      });
      var comOrders = comsTriees.length <= 4 ? permsDe(comsTriees) : [comsTriees, comsTriees.slice().reverse()];
      var chains = [];
      comOrders.forEach(function (cOrd) {
        if (cOrd.length === 1 && parComOrdre[cOrd[0]].length <= 4) {
          permsDe(trierLp(parComOrdre[cOrd[0]])).forEach(function (lpP) { chains.push(lpP); });
        } else {
          var baseByCom = {};
          cOrd.forEach(function (kc) {
            var lp = trierLp(parComOrdre[kc]);
            var pontIdx = lp.findIndex(function (p) { return (capMatPart[p] || 0) < quotaPart[p] && (capSoiPart[p] || 0) < quotaPart[p]; });
            if (pontIdx >= 0 && lp.length > 1) {
              var pItem = lp.splice(pontIdx, 1)[0];
              lp.splice(Math.floor(lp.length / 2), 0, pItem);
            }
            baseByCom[kc] = lp;
          });
          var chBase = [];
          cOrd.forEach(function (kc) { chBase = chBase.concat(baseByCom[kc]); });
          chains.push(chBase);
          for (var ci = 0; ci < cOrd.length; ci++) {
            var kcVar = cOrd[ci], lpVar = baseByCom[kcVar];
            if (lpVar.length > 1 && lpVar.length <= 4) {
              for (var vi = 0; vi < lpVar.length; vi++) {
                var restV = lpVar.filter(function (_, idx) { return idx !== vi; });
                [restV.concat([lpVar[vi]]), [lpVar[vi]].concat(restV)].forEach(function (candLp) {
                  var chVar = [];
                  cOrd.forEach(function (kcc) { chVar = chVar.concat(kcc === kcVar ? candLp : baseByCom[kcc]); });
                  chains.push(chVar);
                });
              }
            }
          }
        }
      });
      // Choisir la chaîne et le point de bascule Matin -> Soir qui évite toute coupure et garde l'équilibre horaire
      var bestSplit = null;
      chains.forEach(function (chainP) {
        for (var si = 0; si <= totalP; si++) {
          var balPenalty = (si > 0 && totalP >= 6 && (si < 3 || totalP - si < 3)) ? 400 : 0;
          var cur = 0, feasible = true, nBridges = 0, fixPenalty = 0, tmpMap = {};
          for (var piS = 0; piS < chainP.length; piS++) {
            var kP = chainP[piS], q = quotaPart[kP];
            var cM = capMatPart[kP] || 0, cS = capSoiPart[kP] || 0;
            var debut = cur, fin = cur + q; cur = fin;
            if (fin <= si) {
              if (cM < q || (fixSoiPart[kP] || 0) > 0) feasible = false;
              if ((fixSoiPart[kP] || 0) > 0) fixPenalty += 100;
              tmpMap[kP] = 'Matin';
            } else if (debut >= si) {
              if (cS < q || (fixMatPart[kP] || 0) > 0) feasible = false;
              if ((fixMatPart[kP] || 0) > 0) fixPenalty += 100;
              tmpMap[kP] = 'Soir';
            } else {
              var needM = si - debut, needS = fin - si;
              if (cM < needM || cS < needS) feasible = false;
              nBridges++;
              tmpMap[kP] = 'Pont';
            }
          }
          var costS = (feasible ? 0 : 5000) + fixPenalty + nBridges * 50 + balPenalty + Math.abs(si - targetMatin) * 15;
          if (!bestSplit || costS < bestSplit.cost) bestSplit = { cost: costS, si: si, map: tmpMap };
        }
      });
      if (bestSplit) {
        crenPart = bestSplit.map;
        targetMatinPlan = bestSplit.si;
        targetSoirPlan = Math.max(0, totalP - bestSplit.si);
      }
    }

    function bonusSecteurNeuf(cd) {
      var b = 0;
      if (aSecteursSemaine) {
        var nj = joursSecteur[cd.cleZ] || 0, nv = visitesSecteur[cd.cleZ] || 0;
        b += nj === 0 ? 120 : (-40 * nj - 5 * nv);
      }
      if (aRejSecteur && cd.nbVus === 0) {
        var nr = rejSecteur[cd.cleZ] || 0;
        b += nr === 0 ? 100 : (-40 * Math.min(4, Math.ceil(nr / 3)));
      }
      return b;
    }

    function passe(maxVusAutorises, strictQuota, strictCren) {
      while (route.length < cibleJour) {
        var dansRoute = {}, routePCount = {}, routeP = {}, routeC = {};
        var matinP = {}, soirP = {}, matinC = {}, soirC = {}, matinE = {}, soirE = {};
        route.forEach(function (it) {
          dansRoute[it.a.code] = true;
          var kp = clePartArret(it), kc = partComMap[kp] || cleNorm(typeof communeParente === 'function' ? communeParente(it.a.commune) : it.a.commune) || 'autre';
          var ke = cleEtablissement(it), crIt = creneauDeItem(it);
          routePCount[kp] = (routePCount[kp] || 0) + 1;
          routeP[kp] = true; routeC[kc] = true;
          if (crIt === 'Matin') { matinP[kp] = true; matinC[kc] = true; matinE[ke] = true; }
          else { soirP[kp] = true; soirC[kc] = true; soirE[ke] = true; }
        });
        var curMatin = route.filter(function (it) { return creneauDeItem(it) === 'Matin'; }).length;
        var curSoir = route.length - curMatin;
        var base = simuler(route).nbRetards;
        var deltaImm = {}, top = [], TOP_K = 32, minTopV = -Infinity, minTopIdx = 0;
        var evalCands = function (collectAll) {
          var allOpts = collectAll ? [] : null;
          for (var ci = 0; ci < cands.length; ci++) {
            var cd = cands[ci];
            if (dansRoute[cd.a.code] || cd.nbVus > maxVusAutorises) continue;
            var remPart = (quotaPart[cd.clePart] || 0) - (routePCount[cd.clePart] || 0);
            if (strictQuota && remPart <= 0) continue;
            var cren = creneauDeItem(cd.it);
            var cCible = crenPart[cd.clePart];
            if (strictCren && cCible && cCible !== 'Pont' && cren !== cCible) continue;
            var sameP = cren === 'Matin' ? matinP : soirP, otherP = cren === 'Matin' ? soirP : matinP;
            var sameC = cren === 'Matin' ? matinC : soirC, otherC = cren === 'Matin' ? soirC : matinC;
            var sameE = cren === 'Matin' ? matinE : soirE;
            var curCren = cren === 'Matin' ? curMatin : curSoir;
            var bonusEquilibre = 0;
            if (cCible && cCible === cren) bonusEquilibre += 300;
            else if (cCible && cCible !== 'Pont' && cCible !== cren) bonusEquilibre -= 800;
            if (cren === 'Matin') {
              if (curMatin < targetMatinPlan) bonusEquilibre += (curSoir >= targetSoirPlan) ? 140 : 40;
              else if (curSoir < targetSoirPlan) bonusEquilibre += sameP[cd.clePart] && !otherP[cd.clePart] ? 10 : -180;
            } else {
              if (curSoir < targetSoirPlan) bonusEquilibre += (curMatin >= targetMatinPlan) ? 140 : 40;
              else if (curMatin < targetMatinPlan) bonusEquilibre += sameP[cd.clePart] && !otherP[cd.clePart] ? 10 : -180;
            }
            // Regroupement sans aller-retour : terminer hôpital et subdivision en cours sur la même demi-journée
            // avant de passer à la subdivision/commune voisine, tout en respectant les quotas équitables
            var bonusZone = (remPart > 0 ? 400 : -200);
            if (!route.length) {
              bonusZone += (densite[cd.a.code] || 0) + bonusSecteurNeuf(cd);
            } else if (curCren > 0) {
              if (sameE[cd.cleE]) bonusZone += 600;
              else if (sameP[cd.clePart]) bonusZone += 450;
              else if (otherP[cd.clePart] && cCible !== 'Pont') bonusZone -= 450;
              else if (sameC[cd.cleCom]) bonusZone += 220;
              else bonusZone -= 180;
            } else {
              if (otherP[cd.clePart] && remPart > 0 && cCible === 'Pont') bonusZone += 200;
              else if (otherC[cd.cleCom]) bonusZone += 120 + bonusSecteurNeuf(cd);
              else bonusZone += (densite[cd.a.code] || 0) + bonusSecteurNeuf(cd);
            }
            var penRarete = o.autreDispos ? -12 * (o.autreDispos[cd.a.code] || 0) : 0;
            var penRotation = cd.nbVus > 0 ? -250 * cd.nbVus : 0;
            var baseScore = cd.score + bonusEquilibre + bonusZone + penRarete + penRotation;
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
    passe(0, true, true);
    if (route.length < cibleJour) passe(0, true, false);
    if (route.length < cibleJour) passe(0, false, false);
    if (route.length < cibleJour) {
      var paliersMap = {};
      cands.forEach(function (cd) { if (cd.nbVus > 0) paliersMap[cd.nbVus] = true; });
      var paliers = Object.keys(paliersMap).map(Number).sort(function (a, b) { return a - b; });
      for (var pi = 0; pi < paliers.length && route.length < cibleJour; pi++) {
        passe(paliers[pi], true, true);
        if (route.length < cibleJour) passe(paliers[pi], true, false);
        if (route.length < cibleJour) passe(paliers[pi], false, false);
      }
    }
    route = equilibrerCreneaux(meilleurOrdre(route, depart, true), cands, depart, targetMatinPlan, targetSoirPlan);
    route = meilleurOrdre(route, depart, false);
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
      if (utilises[im.code]) {
        p.dates.forEach(function (d) {
          (fixes[d] || []).forEach(function (fx) {
            if (fx.code === im.code) {
              fx.impose = true;
              if (im.rdv && !fx.rdv) fx.rdv = im.rdv;
              if (im.etape) { fx.etape = true; if (!fx.rdvDate) fx.rdvDate = im.dateRdv || im.apres || ''; if (!fx.rdvPrisLe) fx.rdvPrisLe = im.prisLe || ''; }
            }
          });
        });
        return;
      }
      var rdv = heureVersMinutes(im.rdv), options = [], horsZone = 0;
      p.dates.forEach(function (d) {
        var j = jourSemaineIndex(d);
        if (isNaN(j) || j < 0 || j > 4 || (im.date && im.date !== d) || (im.apres && d < im.apres) || (ctx.feries && ctx.feries[d])) return;
        (ctx.parCode[im.code] || []).forEach(function (c) {
          if (c.jourIdx !== j || (im.cle && im.cle !== c.cle) || absentLe(c.prat, d)) return;
          var ok = dansCommunes(c, d);
          if (!ok) horsZone++;
          // Tout RDV pris en amont (étape d'un CR précédent ou prioritaire) doit être proposé même hors zone ;
          // le tri ci-dessous privilégie un jour dans la zone sur une semaine (x.hors - y.hors).
          options.push({ d: d, c: c, hors: ok ? 0 : 1 });
        });
      });
      if (!options.length) {
        nonPlaces.push(horsZone ? Object.assign({}, im, { horsCommunes: true }) : Object.assign({}, im));
        return;
      }
      function rangJourImpose(opt) {
        var f = fixes[opt.d];
        if (!f.length) return 1;
        var kzOpt = cleZoneSecteur({ a: arretDepuisCreneau(opt.c, opt.d) });
        if (f.length < Math.min(maxJ, 4) && f.some(function (a) { return cleZoneSecteur({ a: a }) === kzOpt; })) return 0;
        return 2;
      }
      options.sort(function (x, y) {
        var fx = fixes[x.d].length < maxJ ? 0 : 1;
        var fy = fixes[y.d].length < maxJ ? 0 : 1;
        var cx = rdv !== null && x.c.debut <= rdv && rdv <= x.c.fin ? 0 : 1;
        var cy = rdv !== null && y.c.debut <= rdv && rdv <= y.c.fin ? 0 : 1;
        var sx = !im.date ? rangJourImpose(x) : 0;
        var sy = !im.date ? rangJourImpose(y) : 0;
        return fx - fy || cx - cy || x.hors - y.hors || sx - sy || fixes[x.d].length - fixes[y.d].length || (x.d < y.d ? -1 : x.d > y.d ? 1 : 0) || x.c.debut - y.c.debut;
      });
      var o = options[0], a = arretDepuisCreneau(o.c, o.d);
      a.impose = true; if (im.etape) { a.etape = true; a.rdvDate = im.dateRdv || im.apres || ''; a.rdvPrisLe = im.prisLe || ''; }
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

    var parDate = {}, joursSecteur = p.joursSecteur || {}, visitesSecteur = p.visitesSecteur || {};
    ordreJours.forEach(function (d) {
      var autreDispos = {};
      if (codesParJour[d]) {
        codesParJour[d].forEach(function (code) {
          autreDispos[code] = Math.max(0, (nbDisposCode[code] || 1) - 1);
        });
      }
      var resJ = parDate[d] = planifierJour(ctx, d, {
        communes: p.communesPour ? p.communesPour(d) : null, _immCache: immCache, maxJour: maxJ, targetJour: ciblesJour[d] !== undefined ? ciblesJour[d] : maxJ,
        delai: p.delai, exclus: p.exclus, rejetes: p.rejetes, autreDispos: autreDispos,
        joursSecteur: joursSecteur, visitesSecteur: visitesSecteur,
        fixes: fixes[d], depart: p.depart, accepte: p.accepte
      }, utilises);
      var secDuJ = {};
      resJ.forEach(function (a) {
        var kz = cleZoneSecteur({ a: a });
        secDuJ[kz] = (secDuJ[kz] || 0) + 1;
        visitesSecteur[kz] = (visitesSecteur[kz] || 0) + 1;
      });
      var secsJ = Object.keys(secDuJ).filter(function (k) { return secDuJ[k] >= 2; });
      if (!secsJ.length) secsJ = Object.keys(secDuJ);
      secsJ.forEach(function (k) { joursSecteur[k] = (joursSecteur[k] || 0) + 1; });
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
    estVisite: estVisite, appliquerVisite: appliquerVisite, item: item, uid: uid, evaluerInsertion: evaluerInsertion,
    cleZoneSecteur: cleZoneSecteur, definirQuartiersMoteur: definirQuartiersMoteur, definirFavoris: definirFavoris
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Moteur;
