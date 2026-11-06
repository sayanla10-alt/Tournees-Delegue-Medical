  // ------------------------------------------------------------------ Export du programme
  function estMobile() {
    try { return window.matchMedia('(pointer: coarse)').matches && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent); } catch (e) { return false; }
  }
  function normaliserNumero(n) {
    var d = String(n || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.length === 10 && d.charAt(0) === '0') d = '225' + d;
    else if (d.length === 8) d = '225' + d;
    else if (d.length === 10 && d.indexOf('225') !== 0) d = '225' + d;
    return d.length >= 11 ? d : '';
  }
  function lienItineraire(arrets) {
    var pts = arrets.filter(function (a) { return a.lat && a.lon; }).map(function (a) { return (+a.lat).toFixed(5) + ',' + (+a.lon).toFixed(5); });
    var liens = [];
    for (var i = 0; i < pts.length; i += 9) {
      var morceau = pts.slice(i === 0 ? 0 : i - 1, i + 10 - (i === 0 ? 0 : 1));
      if (i > 0 && morceau.length < 2) break;
      if (morceau.length === 1) { liens.push('https://www.google.com/maps/search/?api=1&query=' + morceau[0]); break; }
      var url = 'https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=' + morceau[0] + '&destination=' + morceau[morceau.length - 1];
      if (morceau.length > 2) url += '&waypoints=' + morceau.slice(1, -1).join('%7C');
      liens.push(url);
      if (i + 10 >= pts.length) break;
    }
    return liens;
  }
  // Message WhatsApp : pour chaque jour, un titre puis les établissements dans l'ordre de passage,
  // chacun suivi de ses médecins
  //   Planning du vendredi 23/10/2026 (Serge Alain)
  //
  //   HMA
  //   Dr Assie Augustin
  //   ...
  // 3.25.4 : un bloc par jour ; établissements numérotés dans l'ordre de passage, médecins en puces avec l'heure
  //   *PROGRAMME DU MARDI 27/10/2026*
  //   _Serge Alain · 8 visites_
  //
  //   *1. HMA* _(Adjamé)_
  //   • 08:30  Dr Assie Augustin
  function texteProgramme(dates) {
    var blocs = [];
    dates.forEach(function (d) {
      var l = S.plan.filter(function (a) { return a.date === d; }).slice().sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
      if (!l.length) return;
      var p = d.split('-'), ordre = [], parLieu = {};
      l.forEach(function (a) {
        var k = String(a.lieu || a.quartier || '').trim() || 'Autre lieu';
        if (!parLieu[k]) { parLieu[k] = { commune: a.commune || '', noms: [] }; ordre.push(k); }
        if (!parLieu[k].noms.some(function (x) { return x.nom === a.nom; })) parLieu[k].noms.push({ nom: a.nom, heure: a.heure || '' });
      });
      var lignes = ['*PROGRAMME DU ' + nomJour(d).toUpperCase() + ' ' + p[2] + '/' + p[1] + '/' + p[0] + '*',
        '_' + (moi() ? moi() + ' · ' : '') + l.length + ' visite' + (l.length > 1 ? 's' : '') + (ordre.length > 1 ? ', ' + ordre.length + ' établissements' : '') + '_'];
      ordre.forEach(function (k, n) {
        var x = parLieu[k];
        lignes.push(''); lignes.push('*' + (n + 1) + '. ' + k + '*' + (x.commune && k.indexOf(x.commune) < 0 ? ' _(' + x.commune + ')_' : ''));
        x.noms.forEach(function (m) { lignes.push('• ' + m.nom); });
      });
      blocs.push(lignes.join('\n'));
    });
    return blocs.join('\n\n━━━━━━━━━━\n\n');
  }
  function urlWhatsapp(texte, dest) {
    var num = normaliserNumero(dest || S.config.whatsapp), t = encodeURIComponent(texte);
    if (S.config.waWeb || !estMobile()) return 'https://web.whatsapp.com/send?' + (num ? 'phone=' + num + '&' : '') + 'text=' + t;
    return 'https://wa.me/' + num + '?text=' + t;
  }

  // Intents Android directs : ouverture instantanée sans page blanche intermédiaire
  function ouvrirWhatsapp(texte, dest) {
    var num = normaliserNumero(dest || S.config.whatsapp), t = encodeURIComponent(texte);
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App && window.Capacitor.Plugins.App.openUrl) {
      var capUri = num ? 'whatsapp://send?phone=' + num + '&text=' + t : 'whatsapp://send?text=' + t;
      window.Capacitor.Plugins.App.openUrl({ url: capUri }).catch(function () {
        window.location.href = urlWhatsapp(texte, dest);
      });
      return;
    }
    if (estMobile() && !S.config.waWeb) {
      var directUri = num ? 'whatsapp://send?phone=' + num + '&text=' + t : 'whatsapp://send?text=' + t;
      window.location.href = directUri;
      return;
    }
    window.open(urlWhatsapp(texte, dest), '_blank', 'noopener');
  }

  // Background Sync API / WorkManager en zone blanche
  function declencherBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(function (reg) {
        return reg.sync.register('mediplanner-sync-queue');
      }).catch(function () {});
    }
  }

  // ------------------------------------------------------------------ Actions sur la tournée
  function arret(uid) { return S.plan.filter(function (a) { return a.uid === uid; })[0] || (S.horsPlan || []).filter(function (a) { return a.uid === uid; })[0]; }

  function reordonner(date) {
    var autres = S.plan.filter(function (a) { return a.date !== date; }), duJour = S.plan.filter(function (a) { return a.date === date; });
    var g = S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, jour;
    // 3.25.8 : aujourd'hui, avec une position GPS récente : les visites faites restent, les autres s'enchaînent depuis ma position
    var apres = date === aujourdhui() ? minutesMaintenant() : 0;   // 3.27.13 : pas d'heure déjà passée pour une visite à faire
    if (date === aujourdhui() && g && duJour.some(function (a) { return !a.statut; })) {
      jour = duJour.filter(function (a) { return a.statut; }).concat(Moteur.ordonnerJour(duJour.filter(function (a) { return !a.statut; }), { lat: g.lat, lon: g.lon }, apres));
    } else jour = Moteur.ordonnerJour(duJour, departCoord(), apres);
    S.plan = autres.concat(jour).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    trierPlan();
  }
  function trierPlan() {
    var ordre = {};
    S.plan.forEach(function (a, i) { ordre[a.uid] = i; });
    S.plan.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return ordre[a.uid] - ordre[b.uid];
    });
  }

  // Premier arrivé, premier servi : les médecins qu'un collègue avait ciblés avant nous sont
  // remplacés automatiquement, sauf ceux épinglés, imposés ou déjà visités (simplement signalés).
  function resoudreConflits(conflits) {
    var touches = {}, dates = {}, codes = {};
    conflits.forEach(function (c) {
      codes[c.code] = true;
      S.plan.forEach(function (a) {
        if (a.code === c.code && a.date === c.date && !a.garde && !a.impose && a.etat !== 'valide' && !a.statut) {
          touches[a.uid] = true; dates[a.date] = true; S.rejetes[a.code] = true;
        }
      });
    });
    var d = Object.keys(dates).sort();
    if (!d.length) return 0;
    var p = S.params, reste = S.plan.filter(function (a) { return !touches[a.uid]; });
    var exclus = exclusCollegues(d);
    Object.keys(codes).forEach(function (c) { exclus[c] = true; });
    reste.forEach(function (a) { if (d.indexOf(a.date) < 0) exclus[a.code] = true; });
    var r = Moteur.genererPlanning(ctx(), {
      dates: d, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0, exclus: exclus,
      rejetes: S.rejetes, conserves: reste.filter(function (a) { return d.indexOf(a.date) >= 0; }), imposes: [], depart: departCoord(),
      accepte: filtreCibles()
    });
    S.plan = reste.filter(function (a) { return d.indexOf(a.date) < 0; }).concat(r.arrets);
    trierPlan(); sauver();
    return Object.keys(touches).length;
  }

  function avantTirage() {
    if (!connecte() || !navigator.onLine) return Promise.resolve();
    toast('Vérification des tournées de l\'équipe…', 2000);
    return Promise.race([rafraichirEquipe(), new Promise(function (r) { setTimeout(r, 8000); })]);
  }

  function lancerTirage(portee, force) {
    var p = S.params;
    if (p.mode === 'jour' && jourSemaineIndex(p.dateRef) > 4) { toast('Choisissez un jour de semaine.'); return; }
    if (p.mode === 'jour' && estFerie(p.dateRef)) { toast('Ce jour est férié. Choisissez un autre jour.'); return; }
    var feriesSemaine = p.mode === 'semaine' ? joursOuvres(lundiDe(p.dateRef)).filter(estFerie) : [];
    if (feriesSemaine.length) toast('Jour férié exclu de la semaine : ' + feriesSemaine.map(dateCourte).join(', ') + '.', 4000);
    var renseignees = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide' && !a.corrige; }).length;
    if (renseignees && !force) {
      confirmerPuis('Comptes rendus non enregistrés', renseignees + ' compte' + (renseignees > 1 ? 's' : '') + ' rendu' + (renseignees > 1 ? 's' : '') + ' non enregistré' + (renseignees > 1 ? 's' : '') + ' seront perdus. Continuer ?',
        'Continuer', function () { lancerTirage(portee, true); });
      return;
    }
    avantTirage().then(function () {
      var periode = datesPeriode();
      var cible = portee === 'jour' ? [S.ui.jour] : periode;
      if (portee === 'jour') {
        var dTir = S.ui.jour;
        if (!S.ui.avantTirage || S.ui.avantTirage.date !== dTir || S.ui.aAccepter !== dTir) {
          S.ui.avantTirage = {
            date: dTir,
            arrets: JSON.parse(JSON.stringify(S.plan.filter(function (a) { return a.date === dTir; }))),
            jourEtat: S.jours[dTir] ? JSON.parse(JSON.stringify(S.jours[dTir])) : null,
            rejetes: JSON.parse(JSON.stringify(S.rejetes || {}))
          };
        }
      } else {
        S.ui.avantTirage = null;
      }
      if (portee === 'nouveau') S.rejetes = {};
      // Médecins écartés au nouveau tirage : ceux qui étaient proposés et non conservés
      if (portee === 'jour' || portee === 'semaine') {
        S.plan.forEach(function (a) {
          if (cible.indexOf(a.date) >= 0 && !a.garde && !a.impose && a.etat !== 'valide' && !a.corrige) S.rejetes[a.code] = true;
        });
      }
      var conserves = S.plan.filter(function (a) { return cible.indexOf(a.date) >= 0 && (a.etat === 'valide' || a.corrige || a.garde); });
      var heuresGardees = {};
      if (portee === 'nouveau') {
        // jours déjà planifiés : leurs visites restent (à leur heure), seuls les créneaux libres sont complétés
        conserves = [];
        cible.forEach(function (d) { conserves = conserves.concat(donneesJour(d)); });
        conserves.forEach(function (a) { a.garde = true; heuresGardees[a.uid] = a.heure; });
      }
      // agenda : les autres jours restent ; un praticien déjà prévu à quelques jours d'écart n'est pas repris
      var horsCible = S.plan.filter(function (a) { return cible.indexOf(a.date) < 0; });
      var exclus = p.eviterCollegues !== false ? exclusCollegues(cible) : exclusValides(cible), ecart = Math.max(+p.delai || 0, 5);
      horsCible.forEach(function (a) { if (cible.some(function (d) { return Math.abs(joursEcoules(a.date, d)) < ecart; })) exclus[a.code] = true; });
      Object.keys(refusesActuels().codes).forEach(function (c) { exclus[c] = true; });   // 3.26.94 : retirés à la main : jamais reproposés
      var r = Moteur.genererPlanning(ctx(), {
        dates: cible, communesPour: communesPour, maxJour: +p.maxJour || 8, delai: +p.delai || 0,
        exclus: exclus, rejetes: S.rejetes, conserves: conserves, imposes: S.imposes.concat(rdvProchaines(cible)), depart: departCoord(), accepte: filtreCibles()
      });
      r.arrets.forEach(function (a) { if (heuresGardees[a.uid]) a.heure = heuresGardees[a.uid]; });
      S.plan = horsCible.concat(r.arrets);
      trierPlan();
      // nouvelle tournée : seule sa période est remplacée dans la base, les autres jours publiés restent
      if (portee === 'nouveau') { S.ui.portee = null; LS.set('portee', null); }
      // jours touchés : en brouillon s'ils ont reçu de nouvelles visites ; un recalcul attend « Accepter » ou « Recalculer encore »
      var touches = {}; r.arrets.forEach(function (a) { if (!heuresGardees[a.uid] && !(a.etat === 'valide' || a.corrige)) touches[a.date] = true; });
      if (portee === 'jour') { mettreBrouillon(cible); S.ui.aAccepter = cible[0]; }
      else mettreBrouillon(Object.keys(touches));
      S.ui.voirParams = false; S.ui.ouvert = null;
      if (portee === 'nouveau') { S.ui.jour = cible.filter(function (d) { return S.plan.some(function (a) { return a.date === d; }); })[0] || null; S.ui.aAccepter = null; S.ui.tab = 'semaine'; window.scrollTo(0, 0); }
      sauver(); rendre(); publierPlan(true);
      if (portee === 'jour') setTimeout(function () { centrerElement(document.querySelector('.bandeau-prog.accepter')); }, 60);
      var nG = Object.keys(heuresGardees).length, nN = r.arrets.length - nG;
      var msg = r.arrets.length ? (nG ? (!nN ? 'Aucun créneau libre : les ' + nG + ' visites déjà prévues sont conservées.' : nN + ' visite' + (nN > 1 ? 's' : '') + ' ajoutée' + (nN > 1 ? 's' : '') + ', ' + nG + ' déjà prévue' + (nG > 1 ? 's' : '') + ' conservée' + (nG > 1 ? 's' : '') + '.') : r.arrets.length + ' visites proposées' + (portee === 'jour' ? ' pour ce jour' : '') + '.') : 'Aucun praticien ne correspond à ces critères.';
      var np = r.nonPlaces.filter(function (x) { return !x.etape; });
      if (np.length) msg += ' ' + np.length + ' médecin(s) prioritaire(s) absent(s) sur la période.';
      var attendu = (+p.maxJour || 8) * cible.filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
      if (r.arrets.length && r.arrets.length < attendu * 0.75) {
        msg += ' Moins de visites que prévu : les praticiens présents sont déjà ciblés par l\'équipe, vus récemment ou hors des critères choisis. Élargissez les communes ou les spécialités.';
      }
      toast(msg, 4500);
    });
  }

  function horodatageCourt() { var d = new Date(); return pad2(d.getDate()) + '/' + pad2(d.getMonth() + 1) + ' à ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  // Programme validé puis modifié : il reste validé pour l'équipe, avec la date de modification
  // 3.27.9 : défilement sous le pouce : les prochaines options sont placées là où l'écran a été touché en dernier
  function centrerCarte(uid, pouceY) { centrerQuestion(uid, pouceY); }
  function centrerElement(c, forceQuestion, pouceY) {
    if (!c) return;
    var card = (c.closest && c.closest('.arret.ouvert')) || (document.querySelector && document.querySelector('.arret.ouvert')) || null;
    var cibleEl = (forceQuestion !== false && c.querySelector) ? (c.querySelector('.cr-question') || c.querySelector('.actions-cr') || c.querySelector('.rangee-actions-cr-valide') || c) : c;
    if (!cibleEl) cibleEl = c;
    requestAnimationFrame(function () {
      setTimeout(function () {
        var ent = (document.querySelector('.entete') || { offsetHeight: 0 }).offsetHeight;
        var nav = (document.querySelector('.navigation') || { offsetHeight: 0 }).offsetHeight;
        var dispo = window.innerHeight - ent - nav;
        if (dispo <= 0) return;

        // 1. Identification de l'intitulé / titre pour garantir sa visibilité permanente
        var titreEl = (card && card.querySelector('.etape-titre')) ||
                      (cibleEl.querySelector && cibleEl.querySelector('.etape-titre')) ||
                      (card && card.querySelector('.arret-carte .arret-nom')) ||
                      (card && card.querySelector('.tete-cr')) ||
                      cibleEl;
        var rTitre = titreEl.getBoundingClientRect();

        // 2. Identification des options / boutons à amener sous le pouce
        var optionsEl = (cibleEl.querySelector && (
          cibleEl.querySelector('.cr-boutons') ||
          cibleEl.querySelector('.puces') ||
          cibleEl.querySelector('.actions-cr') ||
          cibleEl.querySelector('.rangee-actions-cr-valide') ||
          cibleEl.querySelector('.tuiles-choix') ||
          cibleEl.querySelector('.rangee-actions') ||
          cibleEl.querySelector('.bouton-plein')
        )) || cibleEl;
        var rOpt = optionsEl.getBoundingClientRect();

        // 3. Hauteur du pouce cible (mémorisée lors du clic)
        var yPouce = (typeof pouceY === 'number' && pouceY > 0) ? pouceY : S.ui.dernierClicY;
        if (!yPouce || yPouce < ent + 20 || yPouce > window.innerHeight - nav - 20) {
          yPouce = ent + Math.max(30, dispo * 0.55);
        }

        // 4. Calcul du déplacement souhaité pour aligner les options sous le pouce
        var cibleOptY = yPouce - Math.min(25, rOpt.height * 0.45);
        var delta = rOpt.top - cibleOptY;

        // 5. 3.27.9 : plus d'exception pour l'intitulé : les options vont toujours sous le dernier point touché

        // 6. GARDE-FOU BAS : Ne pas pousser les options sous la barre de navigation basse
        var maxOptBottom = window.innerHeight - nav - 8;
        var minDelta = rOpt.bottom - maxOptBottom;
        if (delta < minDelta) {
          delta = minDelta;
        }

        var cibleScrollY = Math.max(0, Math.round(window.scrollY + delta));
        window.scrollTo({ top: cibleScrollY, behavior: 'smooth' });
      }, 35);
    });
  }
  // empreinte d'un compte rendu : sert à dire « aucune modification » plutôt que « enregistré »
  function empreinteCr(a) {
    var c = JSON.parse(JSON.stringify(a.cr || {})); delete c.ok;
    return JSON.stringify([c, a.statut || '', a.commentaire || '', a.produits || '', a.prochaine || '', a.activite || '']);
  }
  function validerVisites(uid) {
    var aValider = S.plan.concat(S.horsPlan || []).filter(function (a) { return a.statut && a.etat !== 'valide' && (!uid || a.uid === uid); });
    // modification ouverte puis enregistrée sans rien changer : on le dit, rien n'est renvoyé
    var inchanges = aValider.filter(function (a) { if (a.cr) syncCr(a); return a.corrige && a.empreinte && a.empreinte === empreinteCr(a); });
    inchanges.forEach(function (a) { a.etat = 'valide'; delete a.corrige; delete a.empreinte; });
    if (inchanges.length) {
      aValider = aValider.filter(function (a) { return inchanges.indexOf(a) < 0; });
      if (!aValider.length) { S.ui.ouvert = null; sauver(); rendre(); toast('Aucune modification : le compte rendu est inchangé.'); return; }
    }
    if (!aValider.length) return;
    var t = aujourdhui(), ko = 0, etapes = [];
    aValider.forEach(function (a) {
      var v = { uid: a.uid, date: a.date > t && !S.config.saisieFutur ? t : a.date, idPresence: a.idPresence, code: a.code, nom: a.nom, type: a.type,
                specialite: a.specialite, note: a.note, commune: a.commune, quartier: a.quartier, lieu: a.lieu,
                creneau: a.creneau, statut: a.statut, commentaire: a.commentaire || '', delegue: moi(),
                produits: a.produits || '', prochaine: a.prochaine || '', activite: a.activite || '' };
      if (a.cr) { syncCr(a); Object.assign(v, champsCr(a)); v.statut = a.statut; v.prochaine = a.prochaine || ''; v.produits = a.produits || ''; }
      if (a.corrige) v.correction = true;
      memoriserProduits(a.produits);
      Moteur.appliquerVisite(S.data.praticiens, v, statuts());
      if (S.config.demo) { v.horodatage = new Date().toISOString(); S.data.historique = [v].concat((S.data.historique || []).filter(function (x) { return x.uid !== v.uid; })); }
      else {
        var enFile = S.queue.filter(function (x) { return x.uid === v.uid; })[0];
        if (enFile) { if (enFile.correction === undefined) delete v.correction; S.queue[S.queue.indexOf(enFile)] = v; } else S.queue.push(v);
        // affichage immédiat de la correction dans l'historique local
        if (a.corrige && S.data.historique) S.data.historique.forEach(function (x, i) { if (x.uid === v.uid) S.data.historique[i] = Object.assign({}, x, v); });
      }
      if (estKo(a.statut)) ko++;
      // 3.25.0 : heure de validation (première saisie le jour même) : elle fait foi pour l'ordre de la journée
      if (!a.valideA && a.date === t) a.valideA = minutesVersHeure(minutesMaintenant());
      a.etat = 'valide'; delete a.corrige; delete a.empreinte;
      (S.ui.flashOk = S.ui.flashOk || {})[a.uid] = true;
      // seul un RDV confirmé est placé d'office dans la tournée
      if (a.prochaine && a.prochaine > a.date && (a.cr ? a.rdvConfirme : true)) etapes.push({ code: a.code, apres: a.prochaine, etape: true, dateRdv: a.prochaine, prisLe: v.date });
    });
    // prochaine étape tombant dans la tournée en cours : le praticien y est ajouté comme un RDV
    var placees = 0;
    etapes.forEach(function (im) {
      var deja = S.plan.filter(function (x) { return x.code === im.code && x.date >= im.apres && !x.statut; })[0];
      if (deja) { deja.impose = true; deja.garde = true; deja.etape = true; deja.rdvDate = im.dateRdv; deja.rdvPrisLe = im.prisLe; placees++; return; }
      if (placerImpose(im)) placees++;
    });
    if (placees) marquerModifie();
    ctxCache.data = null;
    S.ui.ouvert = null;
    // 3.25.44 : si la visite est enregistrée comme absente/non réalisée aujourd'hui et remplacement demandé, proposer directement le remplacement sous le pouce
    var cr0 = crDe(aValider[0]);
    var aKoSeul = aValider.length === 1 && estKo(aValider[0].statut) && !aValider[0].hors && aValider[0].date === t && cr0 && cr0.remplacant === 'oui';
    if (aKoSeul) {
      var cands = candidatsRemplacement(aValider[0]);
      if (cands && cands.length) {
        S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + aValider[0].nom, pleine: true, uid: aValider[0].uid, choix: null, garder: true, lieuRef: aValider[0].lieu };
      }
    }
    sauver(); rendre();
    var nCorr = aValider.filter(function (a) { return a.uid && S.queue.some(function (q) { return q.uid === a.uid && q.correction; }); }).length;
    toast((nCorr === aValider.length ? (nCorr > 1 ? nCorr + ' comptes rendus modifiés' : 'Compte Rendu modifié') : aValider.length + ' compte(s) rendu(s) enregistré(s)') + (ko ? '. ' + ko + ' visite(s) non réalisée(s).' : '.') +
      (placees ? ' Prochaine étape ajoutée à votre tournée.' : ''), 4500);
    publierPlan(!placees);
  }

  function ajouterArret(c, date) {
    if (S.plan.some(function (a) { return a.date === date && a.code === c.code; })) { toast('Ce praticien est déjà prévu ce jour-là.'); return false; }
    // 3.27.13 : aujourd'hui, créneau déjà terminé : on prend le créneau suivant du même lieu (ex. le soir)
    if (date === aujourdhui() && c.fin <= minutesMaintenant()) {
      var suite = (ctx().parCode[c.code] || []).filter(function (x) { return x.jourIdx === c.jourIdx && String(x.idPresence) === String(c.idPresence) && x.fin > minutesMaintenant(); })
        .sort(function (x, y) { return x.debut - y.debut; })[0];
      if (suite) c = suite;
    }
    var a = Moteur.arretDepuisCreneau(c, date);
    a.etat = 'ajoute'; a.garde = true;
    S.plan.push(a);
    reordonner(date);
    if (S.ui.tab === 'semaine') mettreBrouillon([date]);
    S.ui.jour = date;
    sauver(); publierPlan();
    var cib = cibleParCollegues(c.code, date);
    toast('Ajouté au ' + dateCourte(date) + (cib.length ? ', attention : aussi prévu par ' + cib[0].delegue : '') + '.');
    return true;
  }

  // Place un médecin « à voir absolument » au meilleur endroit de la tournée existante
  // Prochaines étapes fixées (comme un RDV pris) : placées d'office ce jour-là si le praticien y est présent,
  // sinon au premier jour de présence suivant ; une étape en retard (14 jours au plus) est placée dès que possible.
  // Une étape fixée par un collègue reste la sienne.
  function rdvProchaines(dates) {
    if (!dates.length) return [];
    var c = ctx(), t = aujourdhui(), debut = ajouterJours(t, -14), fin = dates[dates.length - 1], auteur = {}, prisLe = {};
    ((S.data && S.data.historique) || []).forEach(function (v) {
      var pv = String(v.prochaine || '').slice(0, 10);
      if (pv && !auteur[v.code + '|' + pv]) auteur[v.code + '|' + pv] = v.delegue || '';
      if (pv && !prisLe[v.code + '|' + pv]) prisLe[v.code + '|' + pv] = String(v.date || '').slice(0, 10);
    });
    var dejaImposes = ensemble(S.imposes.map(function (x) { return x.code; }));
    return Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
      if (!p.prochaine || p.prochaine < debut || p.prochaine > fin || dejaImposes[p.code] || LS.get('rdvIgnores', {})[p.code + '|' + p.prochaine]) return false;   // 3.26.75 : RDV retiré par le délégué
      var qui = auteur[p.code + '|' + p.prochaine];
      return !qui || estMoi(qui);
    }).map(function (p) { return { code: p.code, apres: p.prochaine < dates[0] ? dates[0] : p.prochaine, etape: true, dateRdv: p.prochaine, prisLe: prisLe[p.code + '|' + p.prochaine] || '' }; });
  }
  function forcerArretJour(code, d, rdv, lieuPrefere) {
    var c = ctx(), p = c.prat[code];
    if (!p) return false;
    var ex = S.plan.filter(function (a) { return a.date === d && a.code === code; })[0];
    if (ex) {
      ex.impose = true; ex.garde = true; ex.inopinee = true;
      if (rdv) ex.rdv = rdv;
      reordonner(d);
      return true;
    }
    var jIdx = jourSemaineIndex(d), now = minutesMaintenant(), estSoir = d === aujourdhui() && now >= 13 * 60;
    var tousCr = c.parCode[code] || [];
    // 3.26.9 : si le délégué remplace ou ajoute au CHU / même établissement, sélectionner d'office ce lieu
    var refLieu = lieuPrefere || (S.ui.feuille && S.ui.feuille.lieuRef) || '';
    if (!refLieu && d === aujourdhui()) {
      var duJour = S.plan.filter(function (x) { return x.date === d; });
      var absente = duJour.filter(function (x) { return x.statut && estKo(x.statut); }).slice(-1)[0];
      if (absente && absente.lieu) refLieu = absente.lieu;
      else if (duJour.length) {
        var courante = duJour.filter(function (x) { return !x.statut; })[0] || duJour.slice(-1)[0];
        if (courante && courante.lieu) refLieu = courante.lieu;
      }
    }
    var cr = null;
    if (refLieu) {
      cr = tousCr.filter(function (x) { return x.jourIdx === jIdx && x.creneau === (estSoir ? 'Soir' : 'Matin') && memeEtablissement(refLieu, x.lieu); })[0] ||
           tousCr.filter(function (x) { return x.jourIdx === jIdx && memeEtablissement(refLieu, x.lieu); })[0] ||
           tousCr.filter(function (x) { return memeEtablissement(refLieu, x.lieu); })[0];
    }
    if (!cr) {
      cr = tousCr.filter(function (x) { return x.jourIdx === jIdx && x.creneau === (estSoir ? 'Soir' : 'Matin'); })[0] ||
           tousCr.filter(function (x) { return x.jourIdx === jIdx; })[0] ||
           tousCr[0];
    }
    if (!cr) {
      var presences = c.presencesParCode[code] || [];
      var pr = (refLieu ? presences.filter(function (x) { return memeEtablissement(refLieu, x.lieu); })[0] : null) ||
               presences[0] ||
               { id: 'IMP-' + code, lieu: p.type === 'Pharmacie' ? p.nom : 'Cabinet', quartier: '', commune: '', zone: '' };
      var qObj = quartiers().filter(function (q) { return q.quartier === pr.quartier; })[0];
      var coord = (pr.lat && pr.lon) ? { lat: +pr.lat, lon: +pr.lon } : (qObj ? { lat: +qObj.lat, lon: +qObj.lon, approx: true } : null);
      cr = {
        cle: (pr.id || code) + '|' + Math.min(jIdx, 4) + '|' + (estSoir ? 'Soir' : 'Matin'),
        idPresence: pr.id || '', code: code, prat: p,
        lieu: pr.lieu || (p.type === 'Pharmacie' ? p.nom : 'Cabinet'),
        quartier: pr.quartier || '', commune: pr.commune || (qObj ? qObj.commune : ''), zone: pr.zone || (qObj ? qObj.zone : ''),
        jourIdx: Math.min(jIdx, 4), jour: JOURS[Math.min(jIdx, 4)] || 'Aujourd\'hui',
        creneau: estSoir ? 'Soir' : 'Matin',
        debut: estSoir ? 15 * 60 : 8 * 60,
        fin: estSoir ? 18 * 60 + 30 : 12 * 60 + 30,
        coord: coord
      };
    }
    var a = Moteur.arretDepuisCreneau(cr, d);
    a.jour = JOURS[Math.min(jIdx, 4)] || a.jour;
    if (cr.jourIdx !== jIdx) {
      a.creneau = estSoir ? 'Soir' : 'Matin';
      a.debut = estSoir ? '15:00' : '08:00';
      a.fin = estSoir ? '18:30' : '12:30';
    }
    a.impose = true; a.garde = true; a.etat = 'ajoute'; a.inopinee = true;
    if (rdv) a.rdv = rdv;
    S.plan.push(a);
    reordonner(d);
    if (!S.jours[d]) mettreBrouillon([d]);
    return true;
  }
  function placerImpose(im) {
    if (im.force && im.date) return forcerArretJour(im.code, im.date, im.rdv);
    var c = ctx(), dates = datesPeriode(), best = null;
    (c.parCode[im.code] || []).forEach(function (cr) {
      dates.forEach(function (d) {
        if (jourSemaineIndex(d) !== cr.jourIdx || (im.date && im.date !== d) || (im.apres && d < im.apres) || (im.cle && im.cle !== cr.cle) || estFerie(d)) return;
        if (S.plan.some(function (a) { return a.date === d && a.code === im.code; })) return;
        var a = Moteur.arretDepuisCreneau(cr, d);
        a.impose = true; a.garde = true; if (im.rdv) a.rdv = im.rdv; if (im.etape) { a.etape = true; a.rdvDate = im.dateRdv || im.apres; a.rdvPrisLe = im.prisLe || ''; }
        var jour = S.plan.filter(function (x) { return x.date === d; });
        var avant = jour.reduce(function (s, x) { return s + (x.dist || 0); }, 0);
        var essai = Moteur.ordonnerJour(jour.map(function (x) { return Object.assign({}, x); }).concat([a]), departCoord());
        var cout = essai.filter(function (x) { return x.retard; }).length * 1000 + essai.reduce(function (s, x) { return s + x.dist; }, 0) - avant + jour.length * 0.5;
        if (!best || cout < best.cout) best = { cout: cout, a: a, d: d };
      });
    });
    if (!best) return false;
    S.plan.push(best.a);
    reordonner(best.d);
    if (!im.etape) S.ui.jour = best.d;
    return true;
  }

  // 3.25.28 : rafraîchissement toutes les 5 minutes, à la réouverture et au rafraîchissement
  // discret : sans message ; sinon (bouton « Actualiser ») : message et position GPS imposée même si un quartier était choisi
  var PERIODE_GPS_MIN = 5;
  function localiser(discret, declencheur, forcerGps) {
    if (!navigator.geolocation) { if (!discret) toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
    if (S.ui.localisation) {
      if (S.ui.localisationT && Date.now() - S.ui.localisationT > 10000) S.ui.localisation = false;
      else return;
    }
    S.ui.localisation = discret ? 'discret' : true;
    S.ui.localisationT = Date.now();
    if (!discret) { toast('Recherche de votre position…'); if (S.ui.tab === 'autour') rendre(); }
    mesurePrecise(function (p) {
      S.ui.localisation = false;
      // 3.26.99 : une mesure moins précise ne remplace pas une mesure récente plus précise, sauf vrai déplacement
      var g0 = gpsFrais();
      if (g0 && g0.prec && p.prec > g0.prec) {
        var ecartM = distanceKm(g0, p) / REGLAGES_MOTEUR.detourRoutier * 1000;
        if (ecartM <= p.prec + g0.prec) p = { lat: g0.lat, lon: g0.lon, prec: g0.prec, garde: true };
      }
      if (!p.garde) { S.ui.posGps = { lat: p.lat, lon: p.lon, t: Date.now(), prec: p.prec }; LS.set('derniereGps', S.ui.posGps); }
      var A = S.ui.autour, r = Moteur.quartierLePlusProche(p.lat, p.lon, quartiers());
      if (!discret || forcerGps || positionGps()) {
        A.lat = p.lat; A.lon = p.lon; A.src = 'gps'; A.prec = p.prec; A.t = Date.now();
        A.quartier = r && r.quartier ? r.quartier.quartier : ''; A.commune = r && r.quartier ? r.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
        LS.set('autour', A);
      }
      rendreSiPossible();
      alerteProximite(declencheur === 'ouverture' || !discret); notifierProximite();
      // 3.27.0 : alerte d'imprécision seulement quand le délégué demande sa position (pas lors des mesures automatiques), au plus une fois par heure ; la précision reste affichée dans l'encadré
      var demande = !discret || declencheur === 'position', dernAl = +LS.get('alerteImprecisT', 0);
      if (demande && p.prec > 150 && !p.garde && Date.now() - dernAl > 3600000) { LS.set('alerteImprecisT', Date.now()); toast('Position imprécise (± ' + p.prec + ' m). Activez la « localisation précise » du téléphone ou approchez-vous d\'une fenêtre.', 5000); }
      else if (!discret && r && r.km > 8) toast('Vous semblez hors d\'Abidjan. Quartier le plus proche : ' + r.quartier.quartier + '.');
    }, function () {
      S.ui.localisation = false; if (S.ui.tab === 'autour') rendreSiPossible();
      if (!discret) toast('Position indisponible. Autorisez la localisation ou choisissez un quartier.');
    });
  }
  // « Par ma position » : la dernière position connue du téléphone sert tout de suite (résultats immédiats)
  function positionConnue() {
    var g = S.ui.posGps, A = S.ui.autour; if (!g) return;
    var r = Moteur.quartierLePlusProche(g.lat, g.lon, quartiers());
    A.lat = g.lat; A.lon = g.lon; A.src = 'gps'; A.prec = g.prec;
    A.quartier = r && r.quartier ? r.quartier.quartier : ''; A.commune = r && r.quartier ? r.quartier.commune : '';
    A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
    LS.set('autour', A);
  }
  // recalcul périodique, quel que soit l'onglet (application au premier plan)
  setInterval(function () { if (!document.hidden) localiser(true, 'periodique'); }, PERIODE_GPS_MIN * 60000);
  // 3.25.40 & 3.25.42 : notification de pharmacie proche déplaçable au pouce en direct (prise sur la poignée, sans bloquer le scroll)
  function attacherGlissementPouce(el) {
    if (!el || el._dragAttache) return;
    el._dragAttache = true;
    var startX = 0, startY = 0, curX = 0, curY = 0, enGlisse = false;

    function onDebut(e) {
      if (e.target.closest('button')) return;
      if (!e.target.closest('.drag-poignee')) return;
      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX - curX;
      startY = pt.clientY - curY;
      enGlisse = true;
      el.classList.add('en-glisse');
    }

    function onBouge(e) {
      if (!enGlisse) return;
      var pt = e.touches ? e.touches[0] : e;
      var nx = pt.clientX - startX;
      var ny = pt.clientY - startY;
      if (e.cancelable) e.preventDefault();
      var rect = el.getBoundingClientRect();
      var maxDx = (window.innerWidth - 60) - (rect.left - curX);
      var minDx = 60 - (rect.right - curX);
      var maxDy = (window.innerHeight - 80) - (rect.top - curY);
      var minDy = 60 - (rect.bottom - curY);
      curX = Math.max(minDx, Math.min(maxDx, nx));
      curY = Math.max(minDy, Math.min(maxDy, ny));
      el.style.transform = 'translate3d(' + curX + 'px, ' + curY + 'px, 0)';
    }

    function onFin() {
      if (!enGlisse) return;
      enGlisse = false;
      el.classList.remove('en-glisse');
    }

    el.addEventListener('touchstart', onDebut, { passive: true });
    window.addEventListener('touchmove', onBouge, { passive: false });
    window.addEventListener('touchend', onFin, { passive: true });
    window.addEventListener('touchcancel', onFin, { passive: true });
  }

  // 3.25.14 : pharmacie ouverte à proximité signalée à chaque rafraîchissement ou réouverture (et dès qu'une nouvelle apparaît),
  // utile dans un quartier mal connu ; « Non » la masque pour la journée
  // 3.26.73 : notification du téléphone (une seule fois par sujet et par jour)
  function notifier(cle, titre, corps, forcer) {
    try {
      if (!LS.get('notifs', false) || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      var deja = LS.get('notifsVues', {}); if (deja.d !== aujourdhui()) deja = { d: aujourdhui(), k: {} };
      if (deja.k[cle] && !forcer) return; deja.k[cle] = true; LS.set('notifsVues', deja);
      var opts = { body: corps, tag: cle, icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [80, 40, 80], data: { url: location.href.split('#')[0] } };
      if (navigator.serviceWorker && navigator.serviceWorker.ready) navigator.serviceWorker.ready.then(function (r) { r.showNotification(titre, opts); }).catch(function () { new Notification(titre, opts); });
      else new Notification(titre, opts);
    } catch (e) {}
  }
  function notifierProximite() {
    if (!pret()) return;
    var plan = S.plan.filter(function (a) { return a.date === aujourdhui(); });
    var sans = plan.filter(function (a) { return !a.statut; }), now = minutesMaintenant();
    var suivante = sans.filter(function (a) { return heureVersMinutes(a.heure) === null || heureVersMinutes(a.heure) >= now; })[0];
    var pv = visiteProche(sans, suivante);
    if (pv) notifier('proche-' + pv.a.uid, (estPharmacie(pv.a) ? 'Pharmacie' : 'Médecin') + ' à ' + metres(pv.d), nomSansType(pv.a.nom) + (pv.a.lieu ? ', ' + abregerHopital(pv.a.lieu) : '') + '. Prévu à ' + (pv.a.heure || '') + ' : le voir maintenant ?');
    var ph = pharmacieProche(plan);
    if (ph) notifier('pharma-' + ph.c.code, 'Pharmacie à ' + metres(ph.d), nomSansType(ph.c.prat.nom) + ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + vuDepuis(ph.c.prat.derniere) + ').');
  }
  function notifierConflits() {
    if (!pret()) return;
    var t = aujourdhui(), dem = ajouterJours(t, 1);
    S.plan.filter(function (a) { return a.date === t || a.date === dem; }).forEach(function (a) {
      var cf = conflitArret(a); if (cf) notifier('conflit-' + a.uid, 'Conflit de programme', a.nom + ' est aussi prévu par ' + cf.delegue + ' le ' + dateFr(cf.date) + '.');
    });
  }
  function alerteProximite(forcer) {
    var el = $('alerteProche');
    var plan = S.plan.filter(function (a) { return a.date === aujourdhui(); }), ph = pret() ? pharmacieProche(plan) : null;
    if (!ph) { if (el) el.hidden = true; return; }
    if (!forcer && S.ui.derniereAlerte === ph.c.code) return;
    S.ui.derniereAlerte = ph.c.code;
    if (S.ui.tab === 'jour' && jourAffiche() === aujourdhui()) return;   // Journée l'affiche déjà en tête
    if (!el) {
      el = document.createElement('div');
      el.id = 'alerteProche';
      el.className = 'alerte-proche';
      document.body.appendChild(el);
      attacherGlissementPouce(el);
    }
    el.innerHTML = '<div class="drag-poignee" title="Glisser au pouce pour déplacer"><span class="drag-barre"></span></div>' +
      '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
      ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
    el.hidden = false;
  }
  // 3.25.36 : mesure GPS haute précision (arrêt immédiat <= 35 m, filtrage des faux relais > 500 m, sans cache obsolète)
  // 3.26.97 : mesure GPS haute précision : on écoute le GPS jusqu'à obtenir ± 20 m (au plus 25 s). Une mesure
  // grossière (Wi-Fi, antenne) n'est retenue qu'à défaut, et signalée comme imprécise.
  function mesurePrecise(ok, ko) {
    if (!navigator.geolocation) { if (ko) ko(); return; }
    var best = null, fini = false, id = null, t = null, t2 = null, debut = Date.now();
    function terminer() {
      if (fini) return; fini = true;
      if (id !== null) navigator.geolocation.clearWatch(id); clearTimeout(t); clearTimeout(t2);
      if (best) ok({ lat: best.coords.latitude, lon: best.coords.longitude, prec: Math.round(best.coords.accuracy || 0) });
      else if (ko) ko();
    }
    function recevoir(p) {
      if (fini) return;
      if (!best || precisionDe(p) < precisionDe(best)) best = p;
      var pr = precisionDe(best);
      if (pr <= 20) terminer();
      else if (pr <= 50 && Date.now() - debut > 8000) terminer();   // bonne précision et déjà 8 s d'écoute : suffisant
    }
    try { navigator.geolocation.getCurrentPosition(recevoir, function () {}, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }); } catch (e) {}
    id = navigator.geolocation.watchPosition(recevoir, function (e) { if (e && e.code === 1) terminer(); }, { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 });
    t2 = setTimeout(function () { if (best && precisionDe(best) <= 50) terminer(); }, 8000);
    t = setTimeout(terminer, 25000);
  }
  function precisionDe(p) { var a = p && p.coords && p.coords.accuracy; return a === null || a === undefined || isNaN(a) ? 9999 : a; }
  function distanceCourte(k) {
    if (k <= 0.035) return 'Sur place';
    if (k < 1) {
      var m = Math.max(10, Math.round(k * 100) * 10);
      return m <= 30 ? 'Sur place (< 30 m)' : m + ' m';
    }
    return km(k);
  }
  // 3.26.99 : distance depuis ma position. Position à plus de ± 50 m : « ≈ » et arrondi à 50 m (pas de fausse précision au mètre)
  var PREC_DISTANCE_M = 50;
  function positionImprecise() { var g = gpsFrais(); return !!(g && g.prec && g.prec > PREC_DISTANCE_M); }
  function distMoi(k, approx) {
    if (k === null || k === undefined) return '';
    if (k <= 0.035) return 'Sur place';
    var imp = positionImprecise();
    if (!imp) return (approx ? '≈ ' : '') + distanceCourte(k);
    return '≈ ' + (k < 1 ? Math.max(50, Math.round(k * 20) * 50) + ' m' : km(k));
  }
  function gpsPrecis() { var g = gpsFrais(); return !!(g && g.prec && g.prec <= 60); }
  // 3.25.8 : position actuelle connue : GPS de moins de 15 min, sinon le point choisi dans « Autour de moi »
  // 3.26.96 : d'où partent les distances affichées (et avec quelle précision), pour que le délégué puisse en juger
  function texteReferenceDistance() {
    // 3.26.98 : juste la précision, sans avertissement (l'alerte reste dans le message qui s'efface)
    var g = gpsFrais();
    if (g) return 'Distances depuis votre position' + (g.prec ? ' (± ' + g.prec + ' m)' : '') + '.';
    var A = S.ui.autour;
    if (A && A.lat !== null && A.lat !== undefined) return 'Distances depuis ' + (A.src === 'gps' ? 'votre dernière position connue' : (A.label || 'le point choisi')) + '.';
    return '';
  }
  function positionActuelle() {
    var g = gpsFrais(); if (g) return { lat: g.lat, lon: g.lon };
    var A = S.ui.autour; return A && A.lat !== null && A.lat !== undefined ? { lat: A.lat, lon: A.lon } : null;
  }
  // position issue du GPS (et non d'un quartier choisi) : à recalculer à chaque ouverture
  // 3.25.9 : rayons proposés autour de moi
  var RAYONS = [0.5, 2, 5, 10];
  // 3.25.14 : 0,5 km par défaut (une fois pour tous)
  if (!LS.get('rayon05', false) || RAYONS.indexOf(+S.ui.autour.rayon) < 0) { S.ui.autour.rayon = 0.5; LS.set('autour', S.ui.autour); LS.set('rayon05', true); }
  // dernière position connue du téléphone (mémoire), utilisée tout de suite au démarrage
  if (!S.ui.posGps) { var dg = LS.get('derniereGps', null); if (dg && isFinite(dg.lat)) S.ui.posGps = dg; }
  function positionGps() { var A = S.ui.autour; return A.src === 'gps' || A.src === 'gps_init' || (!A.src && /^ma position/i.test(A.label || '')) || A.lat === null; }
  function relocaliserSiBesoin(declencheur) { if (!S.ui.localisation) localiser(true, declencheur); }

  function chargerDemo(force) {
    if (pret() && !S.config.demo && force !== true) {
      confirmerPuis('Démonstration', 'Remplacer les données synchronisées par des données de démonstration ?', 'Remplacer', function () { chargerDemo(true); });
      return;
    }
    S.config.demo = true;
    var b = genererBaseFictive(aujourdhui());
    S.data = { version: VERSION_DONNEES, praticiens: b.praticiens, presences: b.presences, quartiers: quartiersDefautObjets(),
               statuts: STATUTS_DEFAUT, historique: [], plannings: [], syncedAt: null };
    S.plan = []; S.queue = []; S.imposes = []; S.rejetes = {}; S.jours = {};
    S.ui.tab = 'semaine'; S.ui.voirParams = false;
    sauver(); rendre();
    toast('Démonstration : ' + b.praticiens.length + ' praticiens, ' + b.presences.length + ' lieux de présence.');
  }

  function copier(texte) {
    if (navigator.clipboard) return navigator.clipboard.writeText(texte).then(function () { toast('Texte copié.'); }, function () { prompt('Copiez ce texte :', texte); });
    prompt('Copiez ce texte :', texte);
  }

  // 3.26.19 : Actualisation GPS sécurisée pour un lieu spécifique d'un praticien (mono ou multi-sites)
  function majGpsPourLieu(code, idxLieu) {
    var d = brouillonFiche(code);
    if (!d || !d.code) return;
    idxLieu = typeof idxLieu === 'number' ? idxLieu : parseInt(idxLieu, 10) || 0;
    var l = (d.lieux && d.lieux[idxLieu]) || (d.lieux && d.lieux[0]);
    if (!l) return;
    if (!navigator.geolocation) { toast('Localisation indisponible.'); return; }
    toast('Recherche de votre position précise…');
    mesurePrecise(function (p) {
      var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) };
      var qDecl = l.quartier ? quartiers().filter(function (q) { return q.quartier === l.quartier; })[0] : null;
      var refGeo = qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : lireCoord(l);
      var distKm = refGeo && isFinite(refGeo.lat) ? distanceVol(pCapt, refGeo) : 0;
      var nomLieu = l.lieu ? (l.lieu + (l.quartier ? ' (' + l.quartier + ')' : '')) : (l.quartier || l.commune || d.nom);

      function sauverDirect() {
        S.ui.posGps = { lat: pCapt.lat, lon: pCapt.lon, t: Date.now(), prec: p.prec };
        LS.set('derniereGps', S.ui.posGps);
        l.lat = pCapt.lat; l.lon = pCapt.lon;
        var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
        if (r && r.quartier) {
          l.quartier = r.quartier.quartier;
          l.commune = r.quartier.commune;
        }
        enregistrerFiche(d); rendre();
        var labelLieu = l.lieu || l.quartier || 'Lieu';
        toast('GPS fixé pour ' + labelLieu + ' : ' + (l.quartier || 'coordonnées enregistrées') + ' (± ' + p.prec + ' m)' + (S.config.demo ? '.' : ', envoyé au Google Sheet.'));
        if (!S.config.demo) synchroniser(true);
      }

      if (refGeo && distKm > 3) {
        var distArr = Math.round(distKm);
        confirmerPuis('Écart de position important',
          '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieu) + ' !</div>' +
          '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant cet établissement</b>.</p>' +
          '<p style="margin:0">Voulez-vous vraiment fixer cette position pour <b>' + esc(nomLieu) + '</b> ?</p>',
          'Écraser la position',
          sauverDirect,
          function () { toast('Position inchangée.'); }
        );
        return;
      }

      sauverDirect();
    }, function () { toast('Position indisponible. Autorisez la localisation.'); });
  }

  // 3.27.34 : Actualisation GPS directe pour un établissement / hôpital depuis le Répertoire
  function majGpsPourHopital(e) {
    if (!navigator.geolocation) { toast('Localisation indisponible.'); return; }
    toast('Recherche de votre position précise…');
    mesurePrecise(function (p) {
      var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) };
      var qDecl = e.quartier ? quartiers().filter(function (q) { return q.quartier === e.quartier; })[0] : null;
      var refGeo = (isFinite(e.lat) && isFinite(e.lon) && e.lat !== 0)
        ? { lat: e.lat, lon: e.lon }
        : (qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : null);
      var distKm = refGeo ? distanceVol(pCapt, refGeo) : 0;
      var nomEtab = e.nom;

      function sauverHopital() {
        S.ui.posGps = { lat: pCapt.lat, lon: pCapt.lon, t: Date.now(), prec: p.prec };
        LS.set('derniereGps', S.ui.posGps);
        e.lat = pCapt.lat;
        e.lon = pCapt.lon;
        var r = Moteur.quartierLePlusProche(pCapt.lat, pCapt.lon, quartiers());
        if (r && r.quartier) {
          if (!e.quartier || /^NL$/i.test(e.quartier)) e.quartier = r.quartier.quartier;
          if (!e.commune || /^NL$/i.test(e.commune)) e.commune = r.quartier.commune;
        }

        // 1. Mettre à jour dans S.data.etablissements
        S.data = S.data || {};
        S.data.etablissements = S.data.etablissements || [];
        var etabTrouve = S.data.etablissements.filter(function (x) { return normaliser(x.nom) === normaliser(nomEtab) || (typeof memeEtablissement === 'function' && memeEtablissement(x.nom, nomEtab)); })[0];
        if (etabTrouve) {
          etabTrouve.lat = pCapt.lat;
          etabTrouve.lon = pCapt.lon;
          if (e.quartier) etabTrouve.quartier = e.quartier;
          if (e.commune) etabTrouve.commune = e.commune;
        } else {
          S.data.etablissements.push({
            code: e.code || ('ETAB-' + ('00' + (S.data.etablissements.length + 1)).slice(-3)),
            nom: nomEtab,
            commune: e.commune || '',
            quartier: e.quartier || '',
            lat: pCapt.lat,
            lon: pCapt.lon,
            telephone: e.telephone || '',
            reperes: e.reperes || ''
          });
        }

        // 2. Répercuter sur toutes les présences de cet établissement
        ((S.data && S.data.presences) || []).forEach(function (x) {
          if (normaliser(x.lieu || '') === normaliser(nomEtab) || (typeof memeEtablissement === 'function' && memeEtablissement(x.lieu, nomEtab))) {
            x.lat = pCapt.lat;
            x.lon = pCapt.lon;
            if (e.quartier) x.quartier = e.quartier;
            if (e.commune) x.commune = e.commune;
          }
        });

        // 3. Répercuter sur l'objet en mémoire
        (e.pres || []).forEach(function (x) {
          x.lat = pCapt.lat;
          x.lon = pCapt.lon;
          if (e.quartier) x.quartier = e.quartier;
          if (e.commune) x.commune = e.commune;
        });

        // 4. Enregistrer dans le cache local et re-rendre
        LS.set('data', S.data);
        ctxCache.data = null;
        rendre();

        // 5. Envoyer au serveur (action: 'etablissement')
        var payload = {
          nom: nomEtab,
          quartier: e.quartier || '',
          commune: e.commune || '',
          lat: pCapt.lat,
          lon: pCapt.lon,
          originegps: 'Repertoire Hopital (±' + p.prec + 'm)'
        };
        if (e.code) payload.code = e.code;
        apiPost('etablissement', payload).then(function () {
          if (!S.config.demo && connecte()) synchroniser(true);
        }).catch(function (err) {
          console.warn('Erreur envoi etablissement:', err);
        });

        toast('GPS fixé pour ' + nomEtab + ' (± ' + p.prec + ' m)' + (S.config.demo ? '.' : ', envoyé au Google Sheet.'));
      }

      if (refGeo && distKm > 3) {
        var distArr = Math.round(distKm);
        confirmerPuis('Écart de position important',
          '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomEtab) + ' !</div>' +
          '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant cet établissement</b>.</p>' +
          '<p style="margin:0">Voulez-vous vraiment fixer cette position pour <b>' + esc(nomEtab) + '</b> ?</p>',
          'Fixer la position',
          sauverHopital,
          function () { toast('Position inchangée.'); }
        );
        return;
      }

      sauverHopital();
    }, function () { toast('Position indisponible. Autorisez la localisation.'); });
  }

  var ACTIONS = {
    nav: function (el) {
      if (S.ui.feuille && el && el.closest && el.closest('.entete')) S.ui.feuille = null;   // 3.26.93 : la roue crantée referme la fenêtre ouverte
      var dest = el.dataset.tab;
      if (dest === 'semaine' && S.ui.tab !== 'semaine' && (!S.plan.length || S.ui.voirParams)) etapesPDepuisDebut();
      // 3.25.42 : Gestion de l'onglet Suivi unifié et compatibilité avec equipe/bilan
      if (dest === 'suivi' || dest === 'bilan' || dest === 'equipe') {
        if (dest === 'bilan' || dest === 'equipe') {
          S.ui.suiviVue = dest;
          LS.set('suiviVue', dest);
        } else if (!S.ui.suiviVue) {
          S.ui.suiviVue = 'bilan';
        }
        if (dest === 'bilan' || (dest === 'suivi' && S.ui.suiviVue === 'bilan')) {
          S.ui.statsVue = 'tableau'; LS.set('statsVue', 'tableau');
        }
        dest = 'suivi';
      }
      if (S.ui.tab === 'semaine' && dest !== 'semaine') { S.ui.jourPlan = S.ui.jour; S.ui.jour = S.ui.jourJournee || aujourdhui(); }
      else if (S.ui.tab !== 'semaine' && dest === 'semaine') { S.ui.jourJournee = S.ui.jour; if (S.ui.jourPlan) S.ui.jour = S.ui.jourPlan; else S.ui.planInit = false; }
      S.ui.tab = dest; S.ui.pharmaciesProches = false;
      // 3.26.50 : Journée s'ouvre toujours sur aujourd'hui (centré dans la frise, grisé si non ouvré)
      if (dest === 'jour') { var tj = aujourdhui(); if (datesPlan().indexOf(tj) >= 0) { S.ui.jour = tj; S.ui.jourVue = null; } else S.ui.jourVue = tj; S.ui.ouvert = null; }
      if (S.ui.tab === 'historique') { S.ui.tab = 'suivi'; S.ui.suiviVue = 'bilan'; S.ui.statsVue = 'historique'; }
      S.ui.feuille = null;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'suivi' && S.ui.suiviVue === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && S.ui.tab === 'suivi' && S.ui.suiviVue === 'equipe') rendreSiPossible(); });
    },
    suiviVue: function (el) {
      S.ui.suiviVue = el.dataset.v;
      LS.set('suiviVue', S.ui.suiviVue);
      rendre();
      if (S.ui.suiviVue === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && (S.ui.tab === 'suivi' || S.ui.tab === 'equipe')) rendreSiPossible(); });
    },
    auditFiltrer: function (el) {
      S.ui.auditFiltre = el.dataset.v;
      rendre();
    },
    reinitFiltresProduits: function () {
      S.ui.rechProduit = '';
      S.ui.aireProduit = '';
      rendre();
    },
    crAucunProduit: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = a.cr;
      c.presentes = 'non';
      c.produits = [];
      c.autres = '';
      majCr(a);
      rendre();
    },
    crStatutExpress: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.statut = el.dataset.v;
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crEtapeRapide: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.prochaine = el.dataset.v || '';
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
    },
    basculerModeComplet: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = true;
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    basculerModeExpress: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = false;
      rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    param: function (el) {
      S.params[el.dataset.k] = el.dataset.v; LS.set('params', S.params);
      if (el.dataset.auto) { S.ui.etapesP.ok[el.dataset.auto] = true; sauverEtapesP(); }
      rendre();
    },
    pEtapePrec: function (el) { S.ui.etapesP.ok[el.dataset.v] = false; sauverEtapesP(); rendre(); },
    pEtapeOk: function (el) { S.ui.etapesP.ok[el.dataset.v] = true; sauverEtapesP(); rendre(); },
    pEtapePasser: function (el) {
      var k = el.dataset.v;
      if (k === 'spec') S.params.specialites = []; if (k === 'valeur') S.params.potentiels = [];
      LS.set('params', S.params); S.ui.etapesP.ok[k] = true; sauverEtapesP(); rendre();
    },
    resumeEditer: function (el) {
      // la tuile touchée ouvre exactement cette option (les autres, déjà répondues, restent repliées)
      var ok = S.ui.etapesP.ok;
      etapesParams().forEach(function (e) { ok[e.id] = e.id !== el.dataset.v; });
      sauverEtapesP(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0);
    },
    pEtapeEditer: function (el) { S.ui.etapesP.ok[el.dataset.v] = false; sauverEtapesP(); rendre(); },
    voirParams: function () { etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); },
    planifierDate: function (el) {
      // Journée vide → Planifier, période réglée sur ce jour (les autres réponses déjà données sont reprises)
      S.params.mode = 'jour'; S.params.dateRef = el.dataset.v; LS.set('params', S.params);
      // période déjà connue (ce jour) : le parcours reprend à l'étape 2, la période reste modifiable
      etapesPDepuisDebut(); S.ui.etapesP.ok.quand = true; sauverEtapesP();
      S.ui.tab = 'semaine'; S.ui.voirParams = true; S.ui.feuille = null; rendre(); window.scrollTo(0, 0);
    },
    ouvrirAnciens: function () { S.ui.feuille = { type: 'anciens', titre: 'Reprendre un ancien programme', pleine: true }; rendre(); },
    reprendre: function (el) { var f = S.ui.feuille; f.source = { type: el.dataset.t, valeur: el.dataset.v }; f.cible = cibleParDefaut(el.dataset.t, el.dataset.v); rendre(); },
    repriseRetour: function () { S.ui.feuille.source = null; rendre(); },
    repriseConfirmer: function () { var f = S.ui.feuille; reprendreProgramme(f.source.type, f.source.valeur, f.cible); },
    repriseConserver: function () { S.ui.annulReprise = null; LS.set('annulReprise', null); rendre(); toast('Programme repris conservé.'); },
    repriseAnnuler: function () {
      var r = S.ui.annulReprise; if (!r) return;
      S.plan = r.plan; if (r.jours) S.jours = r.jours; S.ui.annulReprise = null; LS.set('annulReprise', null);
      S.ui.jour = null; sauver(); rendre(); publierPlan(true); toast('Retour à l\'ancienne planification.');
    },
    fermerParams: function () { S.ui.voirParams = false; rendre(); window.scrollTo(0, 0); },
    voirVisite: function (el) {
      if (S.ui.tab === 'semaine') {
        var a = arret(el.dataset.uid);
        if (a) {
          S.ui.feuille = { type: 'visitePlan', titre: a.nom, uid: a.uid };
          rendre();
          return;
        }
      }
      S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); var c = document.querySelector('.arret.ouvert'); if (c) c.scrollIntoView({ block: 'start' });
    },
    planChangerJour: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = (ctx().parCode[a.code] || []).filter(function (cr) { return String(cr.idPresence) === String(a.idPresence); })[0] || (ctx().parCode[a.code] || [])[0];
      if (c) {
        S.ui.feuille = { type: 'planifierDate', cle: c.cle, d: a.date, d0: prochainJourOuvre(a.date), uidDeplacer: a.uid, titre: 'Déplacer ' + a.nom };
      } else {
        S.ui.feuille = null;
        toast('Créneau de présence introuvable.');
      }
      rendre();
    },
    garderPlan: function (el) { ACTIONS.garder(el); if (S.ui.feuille && S.ui.feuille.type === 'visitePlan') S.ui.feuille = null; rendre(); },
    retirerPlan: function (el) { ACTIONS.retirer(el); if (S.ui.feuille && (S.ui.feuille.type === 'visitePlan' || S.ui.feuille.type === 'remplacer')) S.ui.feuille = null; rendre(); },
    voirDansJournee: function (el) { S.ui.feuille = null; S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); },
    ouvrirAutour: function () { S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; positionConnue(); rendre(); window.scrollTo(0, 0); localiser(true, 'position', true); },
    generer: function () { lancerTirage('nouveau'); },
    tirage: function (el) { lancerTirage(el.dataset.v); },
    jour: function (el) {
      if (el && el.__bloqueClic && Date.now() < el.__bloqueClic) return;
      var b = el.parentNode; if (b && b.classList.contains('bj-jours')) S.ui.bjDepart = el.getBoundingClientRect().left - b.getBoundingClientRect().left;
      S.ui.jour = el.dataset.v; S.ui.jourVue = null; S.ui.ouvert = null; rendre();
    },
    supprimerJour: function (el) {
      var d = el.dataset.v || S.ui.jour;
      demanderSuppressionJour(d);
    },
    jourDecaler: function (el) {
      var d = jourAffiche(), sens = +el.dataset.v;
      do { d = ajouterJours(d, sens); } while (jourSemaineIndex(d) > 4);
      allerAuJour(d);
    },
    jourAujourdhui: function () { allerAuJour(aujourdhui()); },
    jourAller: function (el) {
      var b = el.parentNode; if (b) S.ui.bjDepart = el.getBoundingClientRect().left - b.getBoundingClientRect().left;
      allerAuJour(el.dataset.v);
    },
    jourSemaine: function (el) { allerAuJour(ajouterJours(lundiDe(jourAffiche()), 7 * +el.dataset.v)); },
    ouvrirVisite: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      if (a.date !== jourAffiche() && !a.hors) { S.ui.jour = a.date; S.ui.jourVue = null; }
      S.ui.tab = 'jour'; S.ui.ouvert = a.uid; rendre(); centrerCarte(a.uid, S.ui.dernierClicY);
    },
    ajouterJour: function () { S.ui.dateAjout = jourAffiche(); S.ui.typeAjout = null; S.ui.feuille = { type: 'ajouterJour', titre: 'Ajouter à la journée' }; rendre(); },
    ajouterJourChoix: function (el) {
      S.ui.feuille = null; var v = el.dataset.v;
      if (v === 'autour') ACTIONS.ouvrirAutour(); else ACTIONS.ajouterProches({ dataset: { v: v } });
    },
    allerRapport: function () { S.ui.tab = 'rapport'; rendre(); centrerQuestionRapport(); },
    ouvrirRapport: function () { S.ui.tab = 'rapport'; rendre(); centrerQuestionRapport(); },
    rapOk: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = true; sauverRapports(); rendre(); centrerQuestionRapport(); },
    rapPrec: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); centrerQuestionRapport(); },
    rapPasser: function (el) {
      var R = rapportOuCree(jourAffiche()), k = el.dataset.v;
      if (k === 'besoins') { R.besoins = []; R.besoinsTexte = ''; } else R[k] = '';
      R.ok[k] = true; sauverRapports(); rendre(); centrerQuestionRapport();
    },
    rapEditer: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); centrerQuestionRapport(); },
    sortirRapport: function () { S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); },
    calOuvrir: function (el) {
      var plan = el && el.dataset && el.dataset.ctx === 'plan', d = plan ? (S.ui.jour || aujourdhui()) : jourAffiche();
      S.ui.feuille = { type: 'calendrierJour', titre: plan ? 'Date à planifier' : 'Choisir une date', date: d, mois: d.slice(0, 7), ctx: plan ? 'plan' : '' };
      rendre();
    },
    calChangerMois: function (el) {
      var f = S.ui.feuille;
      if (!f || f.type !== 'calendrierJour') return;
      var parts = f.mois.split('-'), y = +parts[0], m = +parts[1] + (+el.dataset.v);
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      f.mois = y + '-' + pad2(m);
      rendreFeuille();
    },
    calChoisirJour: function (el) {
      var d = el.dataset.v, f = S.ui.feuille;
      S.ui.feuille = null;
      if (f && f.ctx === 'plan') {
        // Planifier : jour déjà planifié -> sélectionné ; sinon la planification s'ouvre sur cette date
        if (d < aujourdhui()) { toast('On ne planifie pas un jour passé.'); rendre(); return; }
        if (datesPlan().indexOf(d) >= 0) { S.ui.jour = d; rendre(); return; }
        S.params.dateRef = d; S.params.mode = 'jour'; LS.set('params', S.params); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); return;
      }
      allerAuJour(d);
    },
    calAllerAujourdhui: function () {
      S.ui.feuille = null;
      allerAuJour(aujourdhui());
    },
    rapBesoin: function (el) {
      var R = rapportOuCree(jourAffiche()), l = R.besoins || (R.besoins = []), v = el.dataset.v;
      if (v === '__tous') {
        var tous = BESOINS_JOUR.every(function (b) { return l.indexOf(b) >= 0; });
        R.besoins = tous ? [] : BESOINS_JOUR.slice();
      } else {
        var i = l.indexOf(v);
        if (i >= 0) l.splice(i, 1); else l.push(v);
      }
      sauverRapports(); rendre();
    },
    rapValider: function (el) {
      var d = el.dataset.v, R = rapportOuCree(d);
      if (R.valideLe && R.empreinte === empreinteRapport(R)) { R.edition = false; sauverRapports(); rendre(); toast('Aucune modification : le compte rendu est inchangé.'); return; }
      confirmerPuis('Valider le compte rendu', 'Valider le compte rendu du <b>' + dateFr(d) + '</b> ? Il sera enregistré dans le Google Sheet.', 'Valider', function () {
        var n = new Date(); R.valideLe = dateFr(d) === dateFr(aujourdhui()) ? pad2(n.getHours()) + ':' + pad2(n.getMinutes()) : dateFr(aujourdhui());
        R.edition = false; R.envoye = false; R.empreinte = empreinteRapport(R); sauverRapports(); rendre();
        if (connecte()) envoyerRapport(d).then(function () { toast('Compte Rendu enregistré. Vous pouvez l\'envoyer sur WhatsApp.'); }, function () { toast('Enregistré sur le téléphone ; envoi au Google Sheet dès le retour du réseau.'); });
        else toast('Compte Rendu validé.');
      });
    },
    rapModifier: function (el) { var R = rapportOuCree(el.dataset.v); R.edition = true; R.ok = {}; sauverRapports(); rendre(); },
    rapWhatsapp: function (el) { ouvrirWhatsapp(texteRapport(el.dataset.v), S.config.waResp); },
    rapCopier: function (el) { copier(texteRapport(el.dataset.v)); },
    jourReprendre: function (el) {
      var d = el.dataset.v;
      confirmerPuis('Reprendre ce programme', 'Remplacer votre tournée en cours par le programme du <b>' + dateFr(d) + '</b> ?<br><span class="discret">Vous pourrez revenir à l\'ancienne planification.</span>',
        'Reprendre', function () { S.ui.jourVue = null; reprendreProgramme('jour', d, d); });
    },
    quitterCarte: function () { S.ui.ouvert = null; rendre(); },
    ouvrir: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      S.ui.ouvert = S.ui.ouvert === el.dataset.uid ? null : el.dataset.uid; rendre();
      if (S.ui.ouvert) centrerCarte(S.ui.ouvert, S.ui.dernierClicY);
    },
    garder: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.garde = !a.garde; if (a.garde) delete S.rejetes[a.code];
      LS.set('plan', S.plan); rendre();
    },
    statut: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.statut = a.statut === el.dataset.v ? '' : el.dataset.v; horodater(a);
      LS.set('plan', S.plan); rendre();
    },
    retirer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      confirmerPuis('Retirer de la tournée', 'Retirer <b>' + esc(a.nom) + '</b> de votre tournée du ' + dateFr(a.date) + ' ?', 'Retirer', function () { retirerArret(a.uid); });
    },
    retirerConfirme: function (el) { retirerArret(el.dataset.uid); },

    rattraper: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      if (!a.statut) { a.statut = 'Absent'; horodater(a); }
      LS.set('plan', S.plan);
      S.ui.autour = Object.assign(S.ui.autour, { lat: a.lat, lon: a.lon, label: a.quartier, moment: a.date === aujourdhui() ? 'maintenant' : 'choisir',
        date: a.date, heure: a.heure, ref: { nom: a.nom, code: a.code, cle: a.cle, date: a.date, heure: a.heure, quartier: a.quartier, creneau: a.creneau } });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; S.ui.pharmaciesProches = false; rendre(); window.scrollTo(0, 0);
    },
    validerProgramme: function () {
      var dates = joursBrouillon();
      confirmerPuis('Confirmer la tournée', 'Confirmer ' + (dates.length > 1 ? 'les ' + dates.length + ' jours en brouillon (' + dates.map(dateCourte).join(', ') + ')' : 'le ' + dateFr(dates[0])) +
        ' ? Ils seront visibles par l\'équipe.<br><span class="discret">Non : vous reprenez le parcours de planification. Sortir : rien ne change.</span>', 'Confirmer', function () { confirmerProgramme(dates); },
        function () { etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0); });
    },
    // après « Recalculer ce jour » : la sélection convient (le jour est confirmé) ou on recalcule encore
    procheOui: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var now = minutesMaintenant(), jour = S.plan.filter(function (x) { return x.date === a.date; });
      // les visites déjà renseignées restent à leur heure ; celle-ci est placée maintenant, les suivantes sont recalculées
      jour.forEach(function (x) { if (x.statut) x.fixe = x.heure; });
      a.avance = minutesVersHeure(Math.ceil(now / 5) * 5);
      reordonner(a.date);
      jour.forEach(function (x) { delete x.fixe; });
      sauver(); rendre(); publierPlan();
      var n = arret(a.uid); toast(a.nom + (el.dataset.ajout ? ' ajouté' : ' ramené') + ' maintenant (' + (n ? n.heure : a.avance) + ') ; les visites suivantes sont recalculées.', 4500);
    },
    pharmaOui: function (el) {
      if ($('alerteProche')) $('alerteProche').hidden = true;
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), t = aujourdhui(); if (!c) return;
      if (!ajouterArret(c, t)) { rendre(); return; }
      var a = S.plan.filter(function (x) { return x.date === t && x.code === c.code; })[0];
      ACTIONS.procheOui({ dataset: { uid: a.uid, ajout: '1' } });
    },
    pharmaNon: function (el) {
      if ($('alerteProche')) $('alerteProche').hidden = true;
      var r = LS.get('refusPharmacies', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), codes: {} };
      r.codes[el.dataset.v] = true; LS.set('refusPharmacies', r); rendre();
    },
    procheNon: function (el) {
      var r = LS.get('refusProches', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), uids: {} };
      r.uids[el.dataset.uid] = true; LS.set('refusProches', r); rendre();
    },
    accepterJour: function () {
      var d = S.ui.aAccepter || S.ui.jour, b = joursBrouillon();
      if (b.indexOf(d) < 0 && !jourConfirme(d)) b.push(d);
      var autres = b.filter(function (x) { return x !== d; });
      if (autres.length > 0) {
        S.ui.feuille = { type: 'choixAccepter', titre: 'Confirmer la tournée', jour: d, jours: b.slice().sort() };
        rendre();
        return;
      }
      confirmerProgramme([d], false);
    },
    accepterPortee: function (el) {
      var f = S.ui.feuille || {}, d = f.jour || S.ui.jour, b = f.jours || joursBrouillon();
      confirmerProgramme(el.dataset.v === 'jour' ? [d] : b, true);
    },
    annulerConfirmation: function () {
      var f = S.ui.feuille || {}, l = f.dates || [];
      if (f.avantJours) {
        Object.keys(f.avantJours).forEach(function (d) { S.jours[d] = f.avantJours[d]; });
      } else {
        mettreBrouillon(l);
      }
      if (f.avantAAccepter) S.ui.aAccepter = f.avantAAccepter;
      S.ui.flashValide = 0;
      sauver(); publierPlan(true);
      var b = joursBrouillon();
      if (f.depuisChoix && b.length > 1) {
        S.ui.feuille = { type: 'choixAccepter', titre: 'Confirmer la tournée', jour: S.ui.jour, jours: b };
      } else {
        S.ui.feuille = null;
        toast('Confirmation annulée : retour au brouillon.');
      }
      rendre();
    },
    // 3.25.22 : Accepter valide puis propose WhatsApp (Oui/Non/Retour) ; Ne pas accepter : revenir à la liste précédente ou relancer un tirage
    accepterProgramme: function () { confirmerProgramme(joursBrouillon(), false); },
    refuserProgramme: function (el) { S.ui.feuille = { type: 'refusProgramme', titre: 'Refuser cette sélection ?', jour: el.dataset.v === 'jour' }; rendre(); },
    continuerModifier: function () {
      var j = S.ui.feuille && S.ui.feuille.jour; S.ui.feuille = null;
      if (j) { S.ui.aAccepter = null; rendre(); toast('Ajoutez, retirez ou épinglez des médecins, puis recalculez.'); return; }
      etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0);
    },
    quitterSansValider: function () { S.ui.feuille = null; S.ui.aAccepter = null; S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); toast('Tournée laissée en brouillon, non envoyée à l\'équipe.'); },
    recalculerEncore: function () { S.ui.feuille = null; lancerTirage('jour'); },
    restaurerAvantTirage: function () {
      var av = S.ui.avantTirage;
      S.ui.feuille = null; S.ui.aAccepter = null;
      if (av && av.date) {
        S.plan = S.plan.filter(function (a) { return a.date !== av.date; }).concat(av.arrets || []);
        trierPlan();
        if (av.jourEtat) S.jours[av.date] = av.jourEtat;
        if (av.rejetes) S.rejetes = av.rejetes;
        S.ui.avantTirage = null;
        sauver(); rendre(); publierPlan(true);
        toast('Liste précédente restaurée.');
        return;
      }
      rendre();
    },
    confirmerProgrammeDirect: function () { confirmerProgramme(); },

    corriger: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return; a.etat = 'correction'; a.corrige = true; a.empreinte = empreinteCr(a);
      var c = crDe(a); c.ok = c.ok || {}; etapesCr(a).forEach(function (x) { if (x.id && x.id.indexOf('__') !== 0) c.ok[x.id] = true; }); S.ui.ouvert = a.uid; LS.set('plan', S.plan); rendre();
      centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    ouvrirExport: function () {
      var f = S.ui.feuille, l = f && f.type === 'valide' ? f.dates || [] : [S.ui.jour];
      if (l.length === 1) S.ui.jour = l[0];
      S.ui.feuille = { type: 'exporter', titre: 'Aperçu du message WhatsApp', portee: l.length > 1 ? 'semaine' : 'jour', retourValide: f && f.type === 'valide' ? f : null, retourAction: 'retourExport' };
      rendre();
    },
    partagerJourWhatsapp: function () {
      S.ui.feuille = { type: 'exporter', titre: 'Aperçu du message WhatsApp', portee: 'jour', retourValide: null, retourAction: 'fermerFeuille' };
      rendre();
    },
    retourExport: function () {
      var f = S.ui.feuille;
      if (f && f.retourValide) { S.ui.feuille = f.retourValide; rendre(); return; }
      S.ui.feuille = null; rendre();
    },
    ajouterTournee: function (el) {
      S.ui.filtresAutour = JSON.parse(JSON.stringify(S.ui.filtres));
      LS.set('filtresAutour', S.ui.filtresAutour);
      S.ui.dateAjout = (el && el.dataset && el.dataset.d) || S.ui.jour; S.ui.typeAjout = null;
      if (S.ui.tab === 'semaine') {
        S.ui.feuille = { type: 'ajouterCommunes', titre: 'Ajouter au ' + dateCourte(S.ui.dateAjout), pleine: true };
        rendre();
        return;
      }
      S.ui.feuille = { type: 'ajouterTournee', titre: 'Autour de moi, ' + dateCourte(S.ui.dateAjout) }; rendre();
    },
    ajouterTourneeChoix: function (el) {
      var j = S.ui.dateAjout || S.ui.jour;
      if (el.dataset.v === 'position' && S.ui.typeAjout) { S.ui.feuille = null; ACTIONS.ajouterProches({ dataset: { v: S.ui.typeAjout, d: j, src: 'position' } }); return; }
      if (el.dataset.v === 'position') {
        S.ui.feuille = null;
        S.ui.filtresAutour = JSON.parse(JSON.stringify(S.ui.filtres));
        LS.set('filtresAutour', S.ui.filtresAutour);
        Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null }); LS.set('autour', S.ui.autour);
        S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; positionConnue(); rendre(); window.scrollTo(0, 0); localiser(true, 'position', true);
        return;
      }
      if (el.dataset.v === 'zone') {
        var zR = LS.get('rechZonePh', null) || {};
        S.ui.feuille = { type: 'ajouterZonePharma', titre: 'Pharmacies dans une zone, ' + dateCourte(j), pleine: true,
          z: { communes: (zR.communes || []).slice(), moment: zR.moment && (zR.moment !== 'maintenant' || j === aujourdhui()) ? zR.moment : (j === aujourdhui() ? 'maintenant' : 'tout') } };
        rendre(); localiser(true, 'position', true); return;
      }
      if (el.dataset.v === 'hopitaux') {
        var hR = LS.get('rechHop', null) || {}; 
        S.ui.feuille = { type: 'ajouterHopitaux', titre: 'Dans des hôpitaux, ' + dateCourte(j), pleine: true,
          h: { lieux: (hR.lieux || []).slice(), specs: (hR.specs || []).slice(), moment: hR.moment && (hR.moment !== 'maintenant' || j === aujourdhui()) ? hR.moment : 'tout' } };
        rendre(); localiser(true, 'position', true); return;
      }
      if (el.dataset.v === 'tout') {
        var tNom = S.ui.typeAjout === 'Médecin' ? 'Tous les médecins' : (S.ui.typeAjout === 'Pharmacie' ? 'Toutes les pharmacies' : 'Tout le répertoire');
        S.ui.feuille = { type: 'ajouterTout', titre: tNom + ', ' + dateCourte(j), pleine: true, q: '' };
        rendre(); localiser(true, 'position', true); return;
      }
      S.ui.feuille = { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(j), pleine: true }; rendre();
    },
    hopMoment: function (el) { var f = S.ui.feuille; if (!f) return; (f.h || f.z).moment = el.dataset.v; rendre(); },
    ajouterCandidat: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), d = S.ui.dateAjout || S.ui.jour; if (!c) return;
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = el.dataset.r === 'recherche' && fAvant ? fAvant : { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(d), pleine: true }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') au ' + dateFr(d) + ' ?', 'Ajouter',
        function () { ajouterArret(c, d); rendre(); }, retourAjout);
    },
    ajouterToutPrat: function (el) {
      var code = el.dataset.code, d = S.ui.dateAjout || S.ui.jour || aujourdhui(), p = ctx().prat[code];
      if (!p) return;
      var deja = S.plan.filter(function (a) { return a.date === d && a.code === code; })[0];
      if (deja) {
        toast(esc(p.nom) + ' est déjà dans la tournée du ' + dateCourte(d) + '.');
        return;
      }
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = fAvant || { type: 'ajouterTout', titre: 'Tout le répertoire, ' + dateCourte(d), pleine: true, q: '' }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(p.nom) + '</b> à la tournée du ' + dateFr(d) + ' ?', 'Ajouter', function () {
        var jIdx = jourSemaineIndex(d);
        var crJour = (ctx().parCode[code] || []).filter(function (x) { return x.jourIdx === jIdx; });
        var ok = false;
        if (crJour.length) {
          ok = ajouterArret(crJour[0], d);
        } else {
          ok = forcerArretJour(code, d);
          if (ok) {
            sauver();
            publierPlan();
            var cib = cibleParCollegues(code, d);
            toast('Ajouté au ' + dateCourte(d) + (cib.length ? ', attention : aussi prévu par ' + cib[0].delegue : '') + '.');
          }
        }
        if (ok) {
          S.ui.feuille = null;
          S.ui.tab = 'jour';
          S.ui.jour = d;
          S.ui.jourVue = null;
          window.scrollTo(0, 0);
          rendre();
        }
      }, retourAjout);
    },
    exportPortee: function (el) { S.ui.feuille.portee = el.dataset.v; rendre(); },
    envoyerWhatsapp: function () {
      var txt = S.ui.feuille && S.ui.feuille.texte;
      if (!txt) return;
      ouvrirWhatsapp(txt, S.config.whatsapp);
      S.ui.feuille = null; rendre();
    },
    copierTexte: function () { copier(S.ui.feuille.texte); },
    partagerTexte: function () { navigator.share({ title: 'Programme de tournée', text: S.ui.feuille.texte }).catch(function () {}); },
    fermerFeuille: function (el, force) {
      var f = S.ui.feuille;
      if (f && f.type === 'fiche' && !force && f.donnees && (f.donnees.nom || (f.donnees.lieux && f.donnees.lieux.some(function (l) { return l.lieu || l.commune; })))) {
        confirmerPuis('Abandonner les modifications ?', 'Vous avez des données non enregistrées sur cette fiche. Quitter sans enregistrer ?', 'Quitter', function () {
          ACTIONS.fermerFeuille(null, true);
        });
        return;
      }
      if (f && f.type === 'listeChoix') { S.ui.feuille = f.retour || null; if (f.dom) rendreFeuille(); else rendre(); return; }
      S.ui.feuille = null; rendre();
    },
    couvPortee: function (el) { S.ui.couvPortee = el.dataset.v; LS.set('couvPortee', S.ui.couvPortee); rendre(); },
    couvOuvrir: function () { S.ui.couvOuverte = !S.ui.couvOuverte; rendre(); },
    couvInterieurToggle: function () { S.ui.couvInterieurOuverte = !S.ui.couvInterieurOuverte; rendre(); },
    couvFiltre: function (el) { S.ui.couvFiltre = el.dataset.v; LS.set('couvFiltre', S.ui.couvFiltre); rendre(); },
    // Communes
    choisirCommunes: function (el) {
      var cle = el.dataset.v, sel = cle === 'tout' ? S.params.communes : (S.params.communesJour[cle] || []);
      S.ui.feuille = { type: 'communes', titre: cle === 'tout' ? 'Communes ciblées' : 'Communes du ' + JOURS[+cle].toLowerCase(), cle: cle, sel: sel.slice() };
      rendre();
    },
    communeToggle: function (el) {
      var f = S.ui.feuille, c = el.dataset.v, i = f.sel.indexOf(c);
      if (i >= 0) f.sel.splice(i, 1); else f.sel.push(c);
      rendre();
    },
    zoneToggle: function (el) {
      var f = S.ui.feuille, l = communesListe().filter(function (c) { return c.zone === el.dataset.v; }).map(function (c) { return c.commune; });
      var tous = l.every(function (c) { return f.sel.indexOf(c) >= 0; });
      l.forEach(function (c) { var i = f.sel.indexOf(c); if (tous && i >= 0) f.sel.splice(i, 1); if (!tous && i < 0) f.sel.push(c); });
      rendre();
    },
    communesToutes: function () {
      var f = S.ui.feuille;
      var tout = [];
      sectionsCommunes().forEach(function (sec) {
        sec.options.forEach(function (op) {
          if (op.estSecteur || !op.parent) tout.push(op.v);
        });
      });
      f.sel = tout;
      rendre();
    },
    communesAucune: function () { S.ui.feuille.sel = []; rendre(); },
    communesOk: function () {
      var f = S.ui.feuille;
      if (f.cle === 'tout') {
        S.params.communes = f.sel.slice();
        // 3.25.35 : Harmonisation avec le filtre maître (Répertoire / Recherche)
        if (S.ui.filtres) { S.ui.filtres.communes = f.sel.slice(); LS.set('filtres', S.ui.filtres); }
        if (S.ui.filtresAutour) { S.ui.filtresAutour.communes = f.sel.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
      } else {
        S.params.communesJour[f.cle] = f.sel.slice();
      }
      if (f.cle === 'tout' && !(S.params.mode === 'semaine' && S.params.parJour)) { S.ui.etapesP.ok.ou = true; sauverEtapesP(); }
      LS.set('params', S.params); S.ui.feuille = null; rendre();
    },
    // À voir absolument
    ouvrirRecherche: function () { S.ui.feuille = { type: 'recherche', titre: 'RDV ou médecin prioritaire', q: '' }; rendre(); var i = $('rechercheImpose'); if (i) i.focus(); },
    choisirImpose: function (el) { S.ui.feuille.code = el.dataset.v; S.ui.feuille.cle = ''; rendre(); },
    retourRecherche: function () { S.ui.feuille.code = null; rendre(); },
    ajouterImpose: function () {
      var f = S.ui.feuille, choix = document.querySelector('input[name=impCle]:checked'), rdv = ($('impRdv').value || '').trim();
      var val = choix ? choix.value : '';
      if (val === '__aujourdhui') {
        var tAuj = aujourdhui(), imAuj = { code: f.code, date: tAuj, force: true };
        if (rdv) imAuj.rdv = rdv;
        S.imposes = S.imposes.filter(function (x) { return x.code !== imAuj.code; }).concat([imAuj]);
        forcerArretJour(f.code, tAuj, rdv, f.lieuRef);
        S.ui.jour = tAuj; S.ui.jourVue = null;
        if (!S.ui.voirParams) S.ui.tab = 'jour';
        S.ui.feuille = null; sauver(); rendre(); publierPlan();
        toast('Ajouté à la tournée d\'aujourd\'hui (' + dateCourte(tAuj) + ').');
        return;
      }
      var im = { code: f.code };
      if (val) { var p = val.split('|'); im.date = p[0]; im.cle = p.slice(1).join('|'); }
      if (rdv) im.rdv = rdv;
      S.imposes = S.imposes.filter(function (x) { return x.code !== im.code; }).concat([im]);
      var place = S.plan.length ? placerImpose(im) : false;
      S.ui.feuille = null; sauver(); rendre();
      if (place) publierPlan();
      toast(place ? 'Ajouté à la tournée du ' + dateCourte(S.ui.jour) + '.' : 'Ajouté. Il sera placé à la prochaine proposition de tournée.');
    },
    retirerImpose: function (el) { S.imposes.splice(+el.dataset.i, 1); LS.set('imposes', S.imposes); rendre(); },
    // 3.26.75 : retrait d'un prioritaire ou d'un RDV de l'étape 7, après confirmation (bouton ou appui long)
    retirerImposeDemande: function (el) {
      var i = +el.dataset.i, im = S.imposes[i]; if (!im) return; var pr = praticien(im.code);
      confirmerPuis('Retirer le prioritaire', 'Retirer <b>' + esc(pr ? pr.nom : im.code) + '</b> des prioritaires ?', 'Retirer', function () { S.imposes.splice(i, 1); LS.set('imposes', S.imposes); rendre(); toast('Prioritaire retiré.'); });
    },
    retirerRdvDemande: function (el) {
      var v = el.dataset.v, code = v.split('|')[0], pr = praticien(code);
      confirmerPuis('Retirer le RDV', 'Ne plus placer d\'office le RDV de <b>' + esc(pr ? pr.nom : code) + '</b> dans la tournée ?', 'Retirer', function () { var ig = LS.get('rdvIgnores', {}); ig[v] = true; LS.set('rdvIgnores', ig); rendre(); toast('RDV retiré de la tournée.'); });
    },
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'Ajouter à ma tournée', code: el.dataset.v, cle: '' }; rendre(); },
    // 3.26.78 : « Ajouter au jour » demande d'abord confirmation
    visiteInopineeDirect: function (el) {
      var code0 = el.dataset.v, p0 = ctx().prat[code0]; if (!p0) return;
      if (!el.dataset.ok) {
        confirmerPuis('Ajouter au jour', 'Ajouter <b>' + esc(p0.nom) + '</b> à votre tournée d\'aujourd\'hui (' + esc(dateCourte(aujourdhui())) + ') ?', 'Ajouter', function () { ACTIONS.visiteInopineeDirect({ dataset: { v: code0, ok: '1' } }); });
        return;
      }
      var code = el.dataset.v, tAuj = aujourdhui();
      var c = ctx(), p = c.prat[code];
      if (!p) return;
      var imAuj = { code: code, date: tAuj, force: true };
      S.imposes = S.imposes.filter(function (x) { return x.code !== code; }).concat([imAuj]);
      forcerArretJour(code, tAuj);
      S.ui.jour = tAuj; S.ui.jourVue = null;
      if (!S.ui.voirParams) S.ui.tab = 'jour';
      sauver(); rendre(); publierPlan();
      toast(p.nom + ' ajouté(e) à la tournée d\'aujourd\'hui (' + dateCourte(tAuj) + ').');
    },
    planifierCle: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v); if (!c) return;
      var d = el.dataset.d || prochaineOccurrence(c.jourIdx, prochainJourOuvre(aujourdhui()), true);
      if (!el.dataset.d) {   // depuis la fiche : choix parmi les prochaines présences (+7, +14…) puis Oui / Non
        S.ui.feuille = { type: 'planifierDate', titre: 'Planifier une visite', cle: el.dataset.v, d: d, d0: d }; rendre(); return;
      }
      confirmerPuis('Planifier une visite', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') à votre tournée du ' + dateFr(d) + ' ?', 'Ajouter',
        function () { if (ajouterArret(c, d)) { S.ui.tab = 'jour'; window.scrollTo(0, 0); } rendre(); });
    },
    planifierDateChoix: function (el) { S.ui.feuille.d = el.dataset.v; rendre(); },
    planifierProchaines: function (el) { S.ui.feuille = { type: 'planifierProchaines', titre: 'Planifier une visite', code: el.dataset.v, sel: '' }; rendre(); },
    planifierProchainesChoix: function (el) { S.ui.feuille.sel = el.dataset.v; rendre(); },
    planifierProchainesOui: function () {
      var f = S.ui.feuille; if (!f || !f.sel) return;
      var i = f.sel.lastIndexOf('@'), c = Moteur.creneauParCle(ctx(), f.sel.slice(0, i)), d = f.sel.slice(i + 1);
      S.ui.feuille = null;
      if (c && ajouterArret(c, d)) { S.ui.tab = 'jour'; S.ui.jour = d; S.ui.jourVue = null; window.scrollTo(0, 0); }
      rendre();
    },
    planifierDateOui: function () {
      var f = S.ui.feuille, c = Moteur.creneauParCle(ctx(), f.cle); S.ui.feuille = null;
      if (f && f.uidDeplacer) {
        var aOld = arret(f.uidDeplacer);
        if (aOld) {
          S.plan = S.plan.filter(function (x) { return x.uid !== aOld.uid; });
          reordonner(aOld.date);
        }
      }
      if (c && ajouterArret(c, f.d)) {
        if (f && f.uidDeplacer) {
          S.ui.jour = f.d;
          toast(c.prat.nom + ' déplacé au ' + dateFr(f.d) + '.');
        } else {
          S.ui.tab = 'jour'; S.ui.jour = f.d; window.scrollTo(0, 0);
        }
      }
      rendre();
    },
    // Autour de moi
    localiser: function () {
      var g = S.ui.posGps, A = S.ui.autour;
      A.src = 'gps';
      if (g && isFinite(g.lat)) {
        var r = Moteur.quartierLePlusProche(g.lat, g.lon, quartiers());
        A.lat = g.lat; A.lon = g.lon; A.prec = g.prec;
        A.quartier = r && r.quartier ? r.quartier.quartier : '';
        A.commune = r && r.quartier ? r.quartier.commune : '';
        A.label = A.quartier ? A.quartier + ' (ma position)' : 'ma position';
        LS.set('autour', A);
        rendre();
      }
      localiser(false, 'position', true);
    },
    // 3.25.9 : enregistre la position GPS du téléphone comme position du lieu (feuille Praticiens/Pharmacies)
    posLieuIci: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), g = S.ui.posGps; if (!c || !g) return;
      confirmerPuis('Position du lieu', 'Enregistrer votre position actuelle (± ' + g.prec + ' m) comme position de <b>' + esc(c.prat.nom) + '</b>, ' + esc(c.lieu || c.quartier) + ' ?', 'Enregistrer', function () {
        var d = brouillonFiche(c.code), l = d.lieux.filter(function (x) { return String(x.id) === String(c.idPresence); })[0];
        if (!l) { toast('Lieu introuvable.'); return; }
        l.lat = +g.lat.toFixed(6); l.lon = +g.lon.toFixed(6);
        enregistrerFiche(d); rendre(); toast('Position enregistrée' + (S.config.demo ? '.' : ', envoi au Google Sheet…'));
        if (!S.config.demo) synchroniser(true);
      });
    },
    autourMoment: function (el) { S.ui.autour.moment = el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    autourRayon: function (el) { S.ui.autour.rayon = +el.dataset.v; LS.set('autour', S.ui.autour); rendre(); },
    ajouterAutour: function (el) {
      var x = (el.dataset.s === 'libre' ? S.ui.resAutourLibre : S.ui.resAutour)[+el.dataset.i]; if (!x) return;
      var d = el.dataset.d, c = x.c;
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) +
        ') à votre tournée du ' + dateFr(d) + ' ?', 'Ajouter', function () { if (ajouterArret(c, d)) rendre(); else rendre(); });
    },
    finRef: function () { S.ui.autour.ref = null; LS.set('autour', S.ui.autour); rendre(); },
    // Divers
    contact: function (el) {
      // 3.25.34 : au clic dans le Répertoire, centrage et défilement fluide sur le praticien
      var code = el.dataset.v;
      S.ui.contactEnTete = null;
      var ouvrant = S.ui.contactOuvert !== code;
      S.ui.contactOuvert = ouvrant ? code : null;
      rendre();
      if (ouvrant) {
        var sel = '[data-a="contact"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(code) : code) + '"]';
        var b = document.querySelector(sel);
        var cible = b ? (b.closest('li.element') || b) : null;
        if (cible && cible.scrollIntoView) {
          cible.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    },
    filtre: function (el) { S.ui.filtre = el.dataset.v; S.ui.limite = 40; rendre(); },
    annuaire: function (el) {
      var v = el.dataset.v, f = filtresCour();
      S.ui.limite = 40; S.ui.contactOuvert = null; S.ui.hopOuvert = null;
      if (v === 'hop') { S.ui.annuaire = 'hop'; LS.set('annuaire', 'hop'); rendre(); window.scrollTo(0, 0); return; }
      S.ui.annuaire = ''; LS.set('annuaire', '');
      f.type = v === 'ph' ? 'Pharmacie' : 'Médecin'; majFiltres(f); rendre(); window.scrollTo(0, 0);
    },
    hopital: function (el) {
      var k = el.dataset.v, ouvrant = S.ui.hopOuvert !== k; S.ui.hopOuvert = ouvrant ? k : null; rendre();
      if (ouvrant) { var b = document.querySelector('[data-a="hopital"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(k) : k) + '"]'); if (b && b.scrollIntoView) b.closest('li').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    },
    capterGpsHopital: function (el, ev) {
      if (ev && ev.stopPropagation) ev.stopPropagation();
      var k = el.dataset.v;
      var h = hopitauxRepertoire().filter(function (x) { return x.cle === k; })[0];
      if (!h) { toast('Établissement introuvable.'); return; }
      majGpsPourHopital(h);
    },
    hopVoirMedecin: function (el) {
      var code = el.dataset.v, f = filtresCour();
      S.ui.annuaire = ''; LS.set('annuaire', ''); f.type = 'Médecin'; majFiltres(f);
      S.ui.recherche = ''; S.ui.contactOuvert = code; S.ui.contactEnTete = code; S.ui.tab = 'praticiens'; rendre(); window.scrollTo(0, 0);
    },
    plus: function () { S.ui.limite += 40; rendre(); },
    collegue: function (el) {
      // 3.25.45 : toucher le collègue sélectionné réinitialise à Toute l'équipe
      var v = el.dataset.v;
      if (S.ui.fq && S.ui.fq.qui === 'liste' && S.ui.fq.liste.length === 1 && S.ui.fq.liste[0] === v) {
        S.ui.fq = { qui: 'tous', liste: [] };
      } else {
        S.ui.fq = { qui: 'liste', liste: [v] };
      }
      LS.set('filtreQui', S.ui.fq); S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    collegueTous: function () {
      S.ui.fq = { qui: 'tous', liste: [] };
      LS.set('filtreQui', S.ui.fq); S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    quiOuvrir: function () { S.ui.feuille = { type: 'qui', titre: 'Délégués', qui: S.ui.fq.qui, liste: S.ui.fq.liste.slice() }; rendre(); },
    quiMode: function (el) { var f = S.ui.feuille; f.qui = el.dataset.v; if (f.qui === 'liste' && !f.liste.length && moi()) f.liste = [moi()]; rendre(); },
    quiToggle: function (el) { var f = S.ui.feuille, i = f.liste.indexOf(el.dataset.v); if (i >= 0) f.liste.splice(i, 1); else f.liste.push(el.dataset.v); rendre(); },
    quiTous: function () {
      var f = S.ui.feuille, noms = nomsDelegues();
      var tous = noms.every(function (n) { return f.liste.indexOf(n) >= 0; });
      f.liste = tous ? [] : noms.slice();
      rendre();
    },
    quiAppliquer: function () {
      var f = S.ui.feuille; S.ui.fq = { qui: f.qui === 'liste' && !f.liste.length ? 'moi' : f.qui, liste: f.qui === 'liste' ? f.liste : [] };
      LS.set('filtreQui', S.ui.fq); S.ui.feuille = null; S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    quandOuvrir: function (el) {
      var o = el.dataset.o, st = S.ui.stats;
      S.ui.feuille = o === 'equipe' ? { type: 'quand', titre: 'Période', onglet: o, periode: S.ui.eqPortee || 'semaine', ref: S.ui.eqDate || aujourdhui() }
        : { type: 'quand', titre: 'Période', onglet: o, periode: st.periode, ref: st.ref || aujourdhui(), debut: bornesStats()[0], fin: bornesStats()[1] };
      rendre();
    },
    quandMode: function (el) { S.ui.feuille.periode = el.dataset.v; rendre(); },
    quandAppliquer: function () {
      var f = S.ui.feuille, ref = (($('quandRef') || {}).value) || f.ref;
      if (f.onglet === 'equipe') { S.ui.eqPortee = f.periode; LS.set('eqPortee', f.periode); S.ui.eqDate = ref; LS.set('eqDate', ref); S.ui.jourEquipe = null; }
      else {
        var st = S.ui.stats; st.periode = f.periode; st.ref = ref;
        if (f.periode === 'perso') { st.debut = ($('quandDebut') || {}).value || f.debut; st.fin = ($('quandFin') || {}).value || f.fin; }
        LS.set('stats', st);
      }
      S.ui.feuille = null; rendre();
    },
    quandDecaler: function (el) {
      var s = +el.dataset.v;
      if (el.dataset.o === 'equipe') { decalerEquipe(s); return; }
      var st = S.ui.stats, t = st.ref || aujourdhui();
      if (st.periode === 'jour') { do { t = ajouterJours(t, s); } while (jourSemaineIndex(t) > 4); }
      else if (st.periode === 'semaine') t = ajouterJours(t, 7 * s);
      else if (st.periode === 'mois') { var m = +t.slice(5, 7) - 1 + s, y = +t.slice(0, 4) + Math.floor(m / 12); m = ((m % 12) + 12) % 12; t = y + '-' + pad2(m + 1) + '-01'; }
      st.ref = t; LS.set('stats', st); rendre();
    },
    eqBascule: function (el) {
      var o = S.ui.eqOuverts || (S.ui.eqOuverts = {}), b = el.getAttribute('aria-expanded') === 'true';
      o[el.dataset.v] = !b; rendre();
    },
    jourEquipe: function (el) { S.ui.jourEquipe = el.dataset.v; rendre(); },
    eqPortee: function (el) { S.ui.eqPortee = el.dataset.v; LS.set('eqPortee', S.ui.eqPortee); S.ui.jourEquipe = null; rendre(); },
    eqDecaler: function (el) { decalerEquipe(+el.dataset.v); },
    eqAujourdhui: function () { S.ui.eqDate = aujourdhui(); LS.set('eqDate', S.ui.eqDate); S.ui.jourEquipe = null; rendre(); },
    histFiltre: function (el) { S.ui.histFiltre = el.dataset.v; LS.set('histFiltre', S.ui.histFiltre); rendre(); },
    valider: function () {
      var n = S.plan.concat(S.horsPlan || []).filter(function (a) { return a.statut && a.etat !== 'valide'; }).length;
      confirmerPuis('Enregistrer les comptes rendus', 'Enregistrer ' + (n > 1 ? 'les ' + n + ' comptes rendus' : 'le compte rendu') + ' en attente ?', 'Enregistrer', function () { validerVisites(); });
    },
    validerUn: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      confirmerPuis(a.corrige ? 'Enregistrer la modification' : 'Enregistrer le compte rendu',
        (a.corrige ? 'Enregistrer la modification du compte rendu de <b>' : 'Enregistrer le compte rendu de <b>') + esc(a.nom) + '</b> (' + dateFr(a.date) + ') ?',
        'Enregistrer', function () { validerVisites(a.uid); });
    },
    notifBascule: function () {
      if (LS.get('notifs', false) && Notification.permission === 'granted') { LS.set('notifs', false); rendre(); toast('Notifications désactivées.'); return; }
      Notification.requestPermission().then(function (p) {
        LS.set('notifs', p === 'granted'); rendre();
        toast(p === 'granted' ? 'Notifications activées.' : 'Notifications refusées par le téléphone.');
      });
    },
    notifTest: function () { notifier('essai', 'MediPlanner', 'Les notifications fonctionnent sur ce téléphone.', true); },
    // 3.26.85 : oublie la copie de la base gardée sur le téléphone et la retélécharge entièrement (tournée et saisies conservées)
    rechargerBase: function () {
      confirmerPuis('Recharger toute la base', 'Retélécharger toute la base (environ 1,4 Mo) ? Votre tournée et vos saisies en attente sont conservées.', 'Recharger', function () {
        if (S.data) { S.data.sig = ''; S.data.syncedAt = ''; S.data.serveurRecent = false; }
        try { localStorage.removeItem(PREFIXE + 'data'); } catch (e) {}
        IDB.del('data');
        synchroniser(false, false, true);
      });
    },
    sync: function () {
      if (S.ui.feuille && S.ui.feuille.type !== 'fiche') { /* la fenêtre reste ouverte : la synchro se fait en arrière-plan */ }
      if (S.config.demo) { toast('Mode démonstration : aucune synchronisation.'); return; }
      if (!S.config.url) { S.ui.tab = 'reglages'; rendre(); return; }
      synchroniser(false);
    },
    enregistrerNom: function () {
      var n = lireNom('nomDelegue');
      if (n.length < 2) { toast('Indiquez votre nom.'); return; }
      S.config.delegue = n; S.config.whatsapp = normaliserNumero($('numWhatsapp').value) || '';
      LS.set('config', S.config); S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); publierPlan();
      toast('Bienvenue ' + n + '.'); inscrireDelegue(n);
    },
    enregistrerMoi: function () {
      var n = lireNom('cfgNom'), w = ($('cfgWhatsapp').value || '').trim();
      if (w && !normaliserNumero(w)) { toast('Numéro WhatsApp non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var wr = (($('cfgWaResp') || {}).value || '').trim();
      if (wr && !normaliserNumero(wr)) { toast('Numéro du responsable non reconnu. Exemple : 07 07 07 07 07.'); return; }
      var ancien = moi(), avant = JSON.stringify([S.config.delegue || '', S.config.whatsapp || '', !!S.config.waWeb, S.config.depart || '', S.config.waResp || '']);
      S.config.delegue = n; S.config.whatsapp = normaliserNumero(w); S.config.waWeb = $('cfgWaWeb').checked; S.config.depart = $('cfgDepart').value; S.config.waResp = normaliserNumero(wr);
      var apres = JSON.stringify([S.config.delegue || '', S.config.whatsapp || '', !!S.config.waWeb, S.config.depart || '', S.config.waResp || '']);
      LS.set('config', S.config); rendre(); toast(avant === apres ? 'Aucune modification : vos réglages sont inchangés.' : 'Réglages enregistrés.');
      inscrireDelegue(n);
      if (n && n !== ancien) publierPlan();
    },
    tester: function () {
      var cfg = { url: ($('cfgUrl').value || '').trim(), token: ($('cfgToken').value || '').trim() };
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(cfg.url)) { toast('L\'URL doit commencer par https://script.google.com/'); return; }
      toast('Test en cours…');
      apiGet('ping', cfg).then(function (r) { toast('Connexion réussie au classeur « ' + r.classeur + ' ».'); }, function (e) { toast(e.message); });
    },
    enregistrerConnexion: function () {
      var url = ($('cfgUrl').value || '').trim(), token = ($('cfgToken').value || '').trim();
      if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(url) || !token) { toast('Renseignez l\'URL (https://script.google.com/…) et le jeton.'); return; }
      if (S.config.demo) { S.plan = []; S.jours = {}; S.queue = []; S.data = null; S.imposes = []; S.rejetes = {}; }
      S.config.url = url; S.config.token = token; S.config.demo = false; S.ui.erreur = ''; sauver();
      toast('Réglages enregistrés. Synchronisation…');
      synchroniser(false).then(function () { if (pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); } });
    },
    demo: function () { chargerDemo(); },
    reinitialiser: function () {
      var msg = enAttente() ? enAttente() + ' élément(s) non envoyé(s) (comptes rendus, fiches) seront perdus. ' : '';
      confirmerPuis('Effacer les données', msg + 'Effacer toutes les données de l\'application sur ce téléphone ?', 'Effacer', function () { LS.vider(); location.reload(); });
    },
    exporterSecours: function () {
      copieSecours();
      var contenu = JSON.stringify({ application: 'MediPlanner', version: APP_VERSION, exporteLe: new Date().toISOString(), delegue: moi(), secours: LS.get('secours', {}) });
      var lien = document.createElement('a'); lien.href = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
      lien.download = 'mediplanner-sauvegarde-' + aujourdhui() + '.json'; document.body.appendChild(lien); lien.click();
      setTimeout(function () { URL.revokeObjectURL(lien.href); lien.remove(); }, 1000);
      toast('Sauvegarde exportée : gardez le fichier en lieu sûr (Drive, e-mail).');
    },
    installer: function () {
      var evt = S.ui.installEvt;
      if (evt) { evt.prompt(); evt.userChoice.then(function () { S.ui.installEvt = null; rendre(); }); return; }
      // iPhone : Apple n'autorise pas l'installation par un bouton ; on montre le geste en une ligne
      S.ui.feuille = { type: 'installer', titre: 'Installer l\'application' }; rendre();
    },
    // Ciblage de la tournée
    paramPeriodeRapide: function (el) {
      S.params.mode = el.dataset.m || 'semaine';
      if (el.dataset.d) S.params.dateRef = el.dataset.d;
      S.ui.etapesP.ok.quand = true; sauverEtapesP();
      LS.set('params', S.params); rendre();
    },
    paramPotentiel: function (el) {
      if (el.dataset.v === 'tous') { S.params.potentiels = []; LS.set('params', S.params); rendre(); return; }
      var l = S.params.potentiels, i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      LS.set('params', S.params); rendre();
    },
    paramSpecToggle: function (el) {
      var v = el.dataset.v, l = S.params.specialites;
      var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v);
      if (l.length) {
        sauverCoeurDeCible(l);
        if (S.ui.filtres) { S.ui.filtres.specialites = l.slice(); LS.set('filtres', S.ui.filtres); }
        if (S.ui.filtresAutour) { S.ui.filtresAutour.specialites = l.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
      }
      LS.set('params', S.params); rendre();
    },
    paramSpecToutes: function () { S.params.specialites = []; LS.set('params', S.params); rendre(); },
    paramSpecDefaut: function () { S.params.specialites = coeurDeCible(); LS.set('params', S.params); rendre(); },
    paramPas: function (el) {
      var k = el.dataset.k, pas = +(el.dataset.pas || el.dataset.v) || 0;
      if (k === 'maxJour') S.params.maxJour = Math.max(1, Math.min(20, (+S.params.maxJour || 8) + pas));
      else if (k === 'delai') S.params.delai = Math.max(0, Math.min(90, (S.params.delai !== undefined ? +S.params.delai : 7) + pas));
      LS.set('params', S.params); rendre();
    },
    choisirSpecialites: function () {
      S.ui.feuille = { type: 'multi', titre: 'Spécialités ciblées (Cœur de cible)', titreGroupe: 'Spécialités', cle: 'specialites', options: specialitesListe(), sel: S.params.specialites.slice(),
                       aide: 'Modifier ces spécialités met automatiquement à jour votre cœur de cible. Aucune sélection = toutes les spécialités.' };
      rendre();
    },
    filtreSpecToggle: function (el) {
      var f = filtresCour(), v = el.dataset.v, l = f.specialites;
      var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v);
      if (l.length) {
        sauverCoeurDeCible(l);
        S.params.specialites = l.slice(); LS.set('params', S.params);
      }
      majFiltres(f); rendre();
    },
    filtreSpecToutes: function () { var f = filtresCour(); f.specialites = []; majFiltres(f); rendre(); },
    filtreSpecCoeur: function () { var f = filtresCour(); f.specialites = coeurDeCible(); majFiltres(f); rendre(); },
    filtreSpecChoisir: function () { ACTIONS.filtreQuestion({ dataset: { v: 'spec' } }); },
    crChoix: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      majCr(a, el.dataset.k, el.dataset.v); validerEtape(a, el.dataset.k); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crOk: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      if (el.dataset.v === 'types') {
        memoriserDerniersTypesCr(estPharmacie(a), c.types);
      }
      if (el.dataset.v === 'reactions') { var memR = LS.get('dernieresReactionsCr', {}); Object.keys(c.reactions || {}).forEach(function (p) { memR[p] = c.reactions[p]; }); LS.set('dernieresReactionsCr', memR); }
      if (el.dataset.v === 'produits') {
        c.reactions = c.reactions || {};
        if (!estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
        produitsPresentes(c).forEach(function (p) {
          if (!Object.prototype.hasOwnProperty.call(c.reactions, p)) c.reactions[p] = 'Intéressé';
        });
      }
      if (el.dataset.v === 'produitsStock') {
        c.stocks = c.stocks || {};
        var selProds = Array.isArray(c.produitsStock) ? c.produitsStock : [];
        Object.keys(c.stocks).forEach(function (p) {
          if (selProds.indexOf(p) < 0) delete c.stocks[p];
        });
        selProds.forEach(function (p) {
          if (!c.stocks[p] || !c.stocks[p].etat) c.stocks[p] = Object.assign(c.stocks[p] || {}, { etat: 'Disponible' });
        });
        memoriserDerniersProduitsStockCr(selProds);
      }
      validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crPasser: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var champs = { precision: ['precision'], bilan: ['bilan'], commentaire: ['commentaire'], besoin: ['besoinTexte'] }[el.dataset.v] || [];
      champs.forEach(function (k) { majCr(a, k, ''); });
      if (el.dataset.v === 'besoin') crDe(a).besoin = [];
      syncCr(a); validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crEditer: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return; editerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    crDate: function (el, e) {
      if (e && typeof e.clientY === 'number' && e.clientY > 0) S.ui.dernierClicY = e.clientY;
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      majCr(a, 'date', el.dataset.v); validerEtape(a, 'date'); rendre(); centrerQuestion(a.uid, S.ui.dernierClicY);
    },
    conflitRemplacer: function (el) { remplacerArret(el.dataset.uid); },
    remplacerChoisir: function (el) {
      var cr = Moteur.creneauParCle(ctx(), el.dataset.v); if (!cr) return;
      S.ui.feuille.choix = {
        cle: el.dataset.v,
        nom: cr.prat.nom,
        note: cr.prat.note,
        heure: el.dataset.h,
        lieu: cr.lieu,
        quartier: cr.quartier,
        commune: cr.commune,
        dist: (el.dataset.dist && el.dataset.dist !== '') ? parseFloat(el.dataset.dist) : null,
        memeLieu: el.dataset.memelieu === '1'
      };
      S.ui.feuille.retourAction = 'remplacerNon';
      rendre();
    },
    remplacerNon: function () {
      if (S.ui.feuille) {
        S.ui.feuille.choix = null;
        S.ui.feuille.retourAction = null;
      }
      rendre();
    },
    remplacerOui: function () {
      var f = S.ui.feuille;
      if (f && f.choix) appliquerRemplacement(f.uid, f.choix.cle, f.garder);
    },
    completerJour: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true, lieuRef: a.lieu }; rendre();
    },
    confirmerOui: function () { var f = S.ui.feuille; S.ui.feuille = null; if (f && f.action) f.action(); else rendre(); },
    confirmerNon: function () { var f = S.ui.feuille; S.ui.feuille = null; if (f && f.non) f.non(); else rendre(); },
    sortirQuestion: function () {
      // quitter sans rien changer : la question se ferme, le parcours en cours aussi (carte ouverte, page de planification ou de recherche)
      S.ui.feuille = null; S.ui.ouvert = null; S.ui.voirParams = false; S.ui.aAccepter = null; S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre();
    },
    conflitGarder: function (el) { var a = arret(el.dataset.uid); if (!a) return; a.conflitOk = true; LS.set('plan', S.plan); rendre(); },
    ajouterProches: function (el) {
      // 3.22.2 : on choisit d'abord la source : ma position, ou les filtres déjà réglés (communes du jour, spécialités)
      if (!el.dataset.src) {
        S.ui.dateAjout = el.dataset.d || S.ui.jour || aujourdhui(); S.ui.typeAjout = el.dataset.v === 'Médecin' ? 'Médecin' : 'Pharmacie';
        S.ui.feuille = { type: 'ajouterTournee', titre: (S.ui.typeAjout === 'Médecin' ? '+ Médecin' : '+ Pharmacie') + ', ' + dateCourte(S.ui.dateAjout) }; rendre(); return;
      }
      // médecins (selon les spécialités de la tournée) ou pharmacies près de ma position, pour le jour affiché dans « Aujourd'hui »
      var j = el.dataset.d || S.ui.jour || aujourdhui(), type = el.dataset.v === 'Médecin' ? 'Médecin' : 'Pharmacie';
      S.ui.filtresAutour = filtresRechercheType(type); LS.set('filtresAutour', S.ui.filtresAutour);
      S.ui.rechercheAutour = ''; S.ui.rechAutourLibre = '';
      Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; S.ui.pharmaciesProches = type; positionConnue(); rendre(); window.scrollTo(0, 0);
      localiser(true, 'position', true);
    },
    crMulti: function (el) { var a = arret(el.dataset.uid); if (!a) return; majCr(a, el.dataset.k, el.dataset.v, true); rendre(); centrerChoix(el); },
    crMultiTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k, c = crDe(a), opts = (S.ui.crOptions[a.uid + '|' + k] || []).map(function (o) { return o[0]; });
      var l = Array.isArray(c[k]) ? c[k] : [];
      var tous = opts.length > 0 && opts.every(function (v) { return l.indexOf(v) >= 0; });
      c[k] = tous ? [] : opts.slice();
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      if (k === 'types') memoriserDerniersTypesCr(estPharmacie(a), c.types);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crTypesAucun: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a); c.types = [];
      memoriserDerniersTypesCr(estPharmacie(a), []);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crGammeFiltre: function (el) {
      S.ui.filtreGammeCr = el.dataset.v || 'tous';
      rendre();
    },
    crGammeBascule: function (el) {
      var g = el.dataset.g;
      if (g === 'B') {
        S.ui.gammeBOuverte = !S.ui.gammeBOuverte;
      } else {
        S.ui.gammeCrOuverte = S.ui.gammeCrOuverte === g ? '' : g;
      }
      rendre();
    },
    crFamilleBascule: function (el) {
      var g = el.dataset.g, f = el.dataset.f;
      S.ui.familleCrOuverte = S.ui.familleCrOuverte || {};
      S.ui.familleCrOuverte[g] = S.ui.familleCrOuverte[g] === f ? '' : f;
      rendre();
    },
    crFamilleTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', g = el.dataset.g, fNom = el.dataset.f;
      var fams = famillesProduitsParGamme(), listeF = (g === 'A' ? fams.gammeA : fams.gammeB).filter(function (x) { return x.nom === fNom; })[0];
      if (!listeF) return;
      var c = crDe(a), l = Array.isArray(c[k]) ? c[k].slice() : [];
      var tous = listeF.produits.length > 0 && listeF.produits.every(function (p) { return l.indexOf(p) >= 0; });
      listeF.produits.forEach(function (p) {
        var i = l.indexOf(p);
        if (tous && i >= 0) l.splice(i, 1);
        else if (!tous && i < 0) l.push(p);
      });
      c[k] = l;
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crProduitsTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', c = crDe(a), tous = produitsRef();
      var l = Array.isArray(c[k]) ? c[k] : [];
      var toutCoche = tous.length > 0 && tous.every(function (p) { return l.indexOf(p) >= 0; });
      c[k] = toutCoche ? [] : tous.slice();
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crProduitsAucun: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', c = crDe(a);
      c[k] = [];
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr([]);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr([]);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crGammeTous: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k || 'produits', g = produitsParGamme(), cible = el.dataset.g === 'A' ? g.gammeA : g.gammeB;
      var c = crDe(a), l = Array.isArray(c[k]) ? c[k].slice() : [];
      var tous = cible.length > 0 && cible.every(function (p) { return l.indexOf(p) >= 0; });
      cible.forEach(function (p) {
        var i = l.indexOf(p);
        if (tous && i >= 0) l.splice(i, 1);
        else if (!tous && i < 0) l.push(p);
      });
      c[k] = l;
      if (k === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
      if (k === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
      syncCr(a); LS.set('plan', S.plan); rendre();
    },
    crActionRemplacer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a); c.remplacant = 'oui'; validerEtape(a, 'remplacant');
      ACTIONS.crRemplacer(el);
    },
    crRemplacer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      syncCr(a); validerVisites(a.uid);
      if (a.hors) return;   // jour passé hors tournée : pas de remplacement après coup
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true, lieuRef: a.lieu }; rendre();
    },
    produit: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeProduits(a.produits), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.produits = l.join(', '); LS.set('plan', S.plan); rendre();
    },
    activite: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var l = listeActivites(a.activite), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      a.activite = l.join(' ; '); LS.set('plan', S.plan); rendre();
    },
    prochaine: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.prochaine = a.prochaine === el.dataset.v ? '' : el.dataset.v;
      LS.set('plan', S.plan); rendre();
    },
    crVal: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var k = el.dataset.k, actuel = k.split('.').reduce(function (o, x) { return o && o[x]; }, crDe(a));
      majCr(a, k, actuel === el.dataset.v && el.dataset.v ? '' : el.dataset.v); rendre(); centrerChoix(el);
    },
    listeOuvrir: function (el) {
      var id = el.dataset.liste, cfg = S.ui.listes[id]; if (!cfg) return;
      var val = cfg.dom ? ($(id) || {}).value : cfg.valeur;
      S.ui.feuille = { type: 'listeChoix', titre: cfg.titre, id: id, sel: val || '', retour: S.ui.feuille, dom: cfg.dom };
      if (cfg.dom) rendreFeuille(); else rendre();
    },
    choix: function (el) {
      var c = cheminObjet(el.dataset.chemin), v = el.dataset.v;
      if (el.dataset.m === '1') {
        var l = c.o[c.k];
        if (el.dataset.parent === '1' || (typeof estGrandeCommune === 'function' && estGrandeCommune(v) && v === communeParente(v))) {
          // Clic sur "Toute la commune" (ex: Cocody) -> coche ou décoche TOUS les sous-secteurs de cette commune
          var par = (typeof communeParente === 'function') ? communeParente(v) : v;
          var secs = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(par) : [];
          var toutCoche = secs.length > 0 && secs.every(function (s) { return l.indexOf(s) >= 0; });
          if (toutCoche) {
            // Décocher tous les sous-secteurs de cette commune
            secs.forEach(function (s) {
              var idx = l.indexOf(s);
              if (idx >= 0) l.splice(idx, 1);
            });
            var idxP = l.indexOf(par);
            if (idxP >= 0) l.splice(idxP, 1);
          } else {
            // Cocher TOUS les sous-secteurs de cette commune
            secs.forEach(function (s) {
              if (l.indexOf(s) < 0) l.push(s);
            });
            var idxP = l.indexOf(par);
            if (idxP >= 0) l.splice(idxP, 1);
          }
        } else {
          // Clic sur un sous-secteur individuel (ex: Cocody – Angré) ou une commune non sectorisée
          var i = l.indexOf(v);
          if (i >= 0) l.splice(i, 1);
          else l.push(v);
        }
      }
      else c.o[c.k] = v;
      var f = S.ui.feuille;
      if (f && f.type === 'listeChoix') {   // sélecteur : la valeur est appliquée et la liste se referme
        var cfg = S.ui.listes[f.id] || {}; S.ui.feuille = f.retour || null;
        if (cfg.dom) {
          var h = $(f.id); if (h) h.value = v;
          var tout = cfg.sections ? [].concat.apply([], cfg.sections.map(function (x) { return x.options; })) : cfg.options;
          var b = $(f.id + 'Btn'); if (b) b.querySelector('span').textContent = (tout.filter(function (o) { return o[0] === v; })[0] || [])[1] || v;
          if (cfg.appliquer) cfg.appliquer(v);
          rendreFeuille(); return;
        }
        if (cfg.appliquer) cfg.appliquer(v);
        rendre(); return;
      }
      if (f && f.type === 'crListe' && !f.multi) {   // choix unique : appliqué tout de suite, question suivante
        var a = arret(f.uid); S.ui.feuille = null;
        if (a) { majCr(a, f.cle, v); validerEtape(a, f.cle); }
        rendre();
        if (a) centrerQuestion(a.uid, S.ui.dernierClicY);
        return;
      }
      rendre();
    },
    crListe: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var cle = el.dataset.k, multi = el.dataset.m === '1', c = crDe(a), opts = S.ui.crOptions[a.uid + '|' + cle] || [];
      var titres = { types: estPharmacie(a) ? 'Activités' : 'Types de visite', produits: 'Produits présentés', motif: 'Motif', besoin: 'Besoin de réapprovisionnement', actionProduits: 'Produits concernés' };
      S.ui.feuille = { type: 'crListe', titre: titres[cle] || 'Choisir', uid: a.uid, cle: cle, multi: multi, options: opts,
        sel: multi ? (c[cle] || []).slice() : (c[cle] || '') };
      rendre();
    },
    crListeTous: function () {
      var f = S.ui.feuille;
      f.sel = f.options.map(function (o) { return o[0]; });
      rendre();
    },
    crListeAucun: function () { S.ui.feuille.sel = []; rendre(); },
    crListeOk: function () {
      var f = S.ui.feuille, a = arret(f.uid); S.ui.feuille = null;
      if (a) {
        crDe(a)[f.cle] = f.sel.slice();
        if (f.cle === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(f.sel);
        if (f.cle === 'produitsStock') memoriserDerniersProduitsStockCr(f.sel);
        syncCr(a); LS.set('plan', S.plan);
        // comme Planifier : la liste validée passe à la question suivante (sauf s'il reste un champ à remplir dans la question)
        if (f.sel.length && (f.cle === 'types')) validerEtape(a, f.cle);
      }
      rendre();
    },
    groupeTout: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not(.puce-tous):not([hidden])').forEach(function (b) { if (b.dataset.v && l.indexOf(b.dataset.v) < 0) l.push(b.dataset.v); });
      rendre();
    },
    groupeToutToggle: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      if (el.dataset.vide === '1') { c.o[c.k] = []; rendre(); return; }
      var vs = [];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not(.puce-tous):not([hidden])').forEach(function (b) { if (b.dataset.v) vs.push(b.dataset.v); });
      var tous = vs.length > 0 && vs.every(function (v) { return l.indexOf(v) >= 0; });
      if (tous) c.o[c.k] = [];
      else vs.forEach(function (v) { if (l.indexOf(v) < 0) l.push(v); });
      rendre();
    },
    groupeAucun: function (el) { var c = cheminObjet(el.dataset.chemin); c.o[c.k] = []; rendre(); },
    sectionToute: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      if (!l) l = c.o[c.k] = [];
      var secEl = el.closest('.section-choix');
      var cibles = secEl.querySelectorAll('.puce-secteur, .puce:not(.puce-secteur):not(.puce-parente):not(.puce-tous)');
      var vs = [];
      cibles.forEach(function (b) { if (b.dataset.v) vs.push(b.dataset.v); });
      var tous = vs.length > 0 && vs.every(function (v) { return l.indexOf(v) >= 0; });
      if (tous) {
        vs.forEach(function (v) { var i = l.indexOf(v); if (i >= 0) l.splice(i, 1); });
      } else {
        vs.forEach(function (v) { if (l.indexOf(v) < 0) l.push(v); });
      }
      rendre();
    },
    sectionBascule: function (el) {
      var f = S.ui.feuille, cle = el.dataset.acc || 'defaut', v = el.dataset.v, memo = LS.get('secOuverte', {});
      f.secOuvertes = f.secOuvertes || {};
      var actuel = f.secOuvertes[cle] !== undefined ? f.secOuvertes[cle] : (f.secOuverte !== undefined ? f.secOuverte : memo[cle]);
      var nouveau = actuel === v && el.getAttribute('aria-expanded') === 'true' ? '' : v;
      f.secOuvertes[cle] = nouveau;
      f.secOuverte = nouveau;
      memo[cle] = nouveau;
      LS.set('secOuverte', memo);
      rendreFeuille();
      var b = document.querySelector('.feuille [data-a="sectionBascule"][data-acc="' + (window.CSS && CSS.escape ? CSS.escape(cle) : cle) + '"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]') ||
              document.querySelector('.feuille [data-a="sectionBascule"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]');
      if (b) b.scrollIntoView({ block: 'nearest' });
    },
    basculeGroupe: function (el) { var f = S.ui.feuille; f.ouverts = f.ouverts || {}; f.ouverts[el.dataset.v] = !f.ouverts[el.dataset.v]; rendre(); },
    filtreRapide: function (el) {
      var f = filtresCour(), k = el.dataset.k, v = el.dataset.v;
      if (Array.isArray(f[k])) { var i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); else f[k].push(v); }
      else f[k] = f[k] === v ? 'tous' : v;
      if (el.dataset.fin) { var et = etatEtapes(); Object.keys(QUESTIONS_FILTRES).forEach(function (q) { et.ok[q] = true; }); et.ouvert = false; sauverEtapes(); }
      majFiltres(f); if (!finRecherche()) rendre();
    },
    filtreType: function (el) { var f = filtresCour(); f.type = el.dataset.v; majFiltres(f); rendre(); },
    multiToggle: function (el) { var f = S.ui.feuille, i = f.sel.indexOf(el.dataset.v); if (i >= 0) f.sel.splice(i, 1); else f.sel.push(el.dataset.v); rendre(); },
    multiToggleAutres: function () { var f = S.ui.feuille; if (f) { f.autresOuvert = !f.autresOuvert; rendreFeuille(); } },
    multiTous: function () {
      var f = S.ui.feuille;
      f.sel = f.options.map(function (o) { return o.nom; });
      rendre();
    },
    multiAucun: function () { S.ui.feuille.sel = []; rendre(); },
    multiOk: function () {
      var f = S.ui.feuille; S.params[f.cle] = f.sel.slice(); LS.set('params', S.params);
      if (f.cle === 'specialites') {
        if (f.sel.length) {
          sauverCoeurDeCible(f.sel);
          if (S.ui.filtres) { S.ui.filtres.specialites = f.sel.slice(); LS.set('filtres', S.ui.filtres); }
          if (S.ui.filtresAutour) { S.ui.filtresAutour.specialites = f.sel.slice(); LS.set('filtresAutour', S.ui.filtresAutour); }
        }
        S.ui.etapesP.ok.spec = true; sauverEtapesP();
      }
      S.ui.feuille = null; rendre();
    },
    // Filtres avancés
    ouvrirFiltres: function () {
      var b = JSON.parse(JSON.stringify(filtresCour()));
      S.ui.feuille = { type: 'filtres', titre: 'Tous les filtres', pleine: true, brouillon: b, tri: S.ui.tri, ouverts: { spec: b.specialites.length > 0, com: b.communes.length > 0 } };
      rendre();
    },
    etapeFiltre: function (el) {
      var f = filtresCour(), k = el.dataset.k, v = el.dataset.v;
      if (k === 'tri') { S.ui.tri = v; LS.set('tri', v); }
      else if (k === 'potentiels' && v === 'tous') { f.potentiels = []; majFiltres(f); }
      else { if (el.dataset.m === '1') { var i = f[k].indexOf(v); if (i >= 0) f[k].splice(i, 1); else f[k].push(v); } else f[k] = v; majFiltres(f); }
      if (el.dataset.auto) { etatEtapes().ok[el.dataset.auto] = true; sauverEtapes(); }
      if (!finRecherche()) rendre();
    },
    rechTuile: function (el) {
      var et = etatEtapes(); et.ouvert = false;
      etapesFiltres(S.ui.filtres).forEach(function (e) { et.ok[e.id] = e.id !== el.dataset.v; });
      sauverEtapes(); S.ui.rechOuverte = true; LS.set('rechOuverte', true); rendre();
    },
    produitOuvrir: function (el) { S.ui.feuille = { type: 'ficheProduit', titre: el.dataset.v, produit: el.dataset.v, pleine: true, ouvertes: {} }; rendre(); var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0; },
    ficheSection: function (el) { var f = S.ui.feuille; f.ouvertes[el.dataset.v] = !f.ouvertes[el.dataset.v]; rendre(); },
    aireBascule: function (el) { var o = S.ui.airesOuvertes = S.ui.airesOuvertes || {}; o[el.dataset.v] = !o[el.dataset.v]; rendre(); },
    aireProduit: function (el) { S.ui.aireProduit = el.dataset.v; rendre(); },
    rechOuvrir: function () {
      var et = etatEtapes(); et.ok = {}; et.ouvert = false; sauverEtapes(); S.ui.rechOuverte = true; LS.set('rechOuverte', true); rendre(); window.scrollTo(0, 0); },
    rechFermer: function () { S.ui.rechOuverte = false; LS.set('rechOuverte', false); rendre(); window.scrollTo(0, 0); },
    etapePrec: function (el) { etatEtapes().ok[el.dataset.v] = false; sauverEtapes(); rendre(); },
    etapeOk: function (el) { etatEtapes().ok[el.dataset.v] = true; sauverEtapes(); if (!finRecherche()) rendre(); },
    etapePasser: function (el) {
      var f = filtresCour(), vide = JSON.parse(JSON.stringify(FILTRES_VIDES));
      QUESTIONS_FILTRES[el.dataset.v].cles.forEach(function (k) { f[k] = vide[k]; }); majFiltres(f);
      etatEtapes().ok[el.dataset.v] = true; sauverEtapes(); rendre();
    },
    etapeEditer: function (el) { var et = etatEtapes(); et.ok[el.dataset.v] = false; et.ouvert = false; sauverEtapes(); rendre(); },
    etapesBascule: function () { var et = etatEtapes(); et.ouvert = !et.ouvert; sauverEtapes(); rendre(); },
    filtreQuestion: function (el) {
      var b = JSON.parse(JSON.stringify(filtresCour())), k = el.dataset.v;
      S.ui.feuille = { type: 'filtres', titre: QUESTIONS_FILTRES[k].titre, pleine: k === 'spec' || k === 'com', question: k, brouillon: b, tri: S.ui.tri, ouverts: {} };
      rendre();
    },
    filtreBrouillon: function (el) {
      var b = S.ui.feuille.brouillon, k = el.dataset.k, v = el.dataset.v;
      if (el.dataset.m === '1') { var i = b[k].indexOf(v); if (i >= 0) b[k].splice(i, 1); else b[k].push(v); }
      else b[k] = v;
      rendre();
    },
    filtresReinit: function () {
      var f = S.ui.feuille, vide = JSON.parse(JSON.stringify(FILTRES_VIDES));
      if (f.question) QUESTIONS_FILTRES[f.question].cles.forEach(function (k) { f.brouillon[k] = vide[k]; });
      else { f.brouillon = vide; f.tri = 'priorite'; }
      rendre();
    },
    filtresOk: function () {
      var f = S.ui.feuille;
      if (f.brouillon && Array.isArray(f.brouillon.specialites) && f.brouillon.specialites.length) {
        sauverCoeurDeCible(f.brouillon.specialites);
        S.params.specialites = f.brouillon.specialites.slice(); LS.set('params', S.params);
      }
      majFiltres(f.brouillon);
      if (f.tri && f.tri !== S.ui.tri) { S.ui.tri = f.tri; LS.set('tri', S.ui.tri); }
      if (f.question) { etatEtapes().ok[f.question] = true; sauverEtapes(); }
      S.ui.feuille = null; rendre();
    },
    retirerFiltre: function (el) {
      var f = filtresCour(), k = el.dataset.k;
      if (Array.isArray(f[k])) f[k] = f[k].filter(function (x) { return x !== el.dataset.v; }); else f[k] = 'tous';
      majFiltres(f); rendre();
    },
    effacerFiltres: function () {
      majFiltres(JSON.parse(JSON.stringify(FILTRES_VIDES)));
      if (S.ui.tab === 'autour') S.ui.rechercheAutour = ''; else S.ui.recherche = '';
      S.ui.etapesF[cleFiltres()] = { ok: {} }; sauverEtapes(); rendre();
    },
    // Fiche praticien
    ficheSpecRapide: function (el) {
      var fe = S.ui.feuille;
      if (fe && fe.type === 'fiche') {
        fe.d.specialite = el.dataset.v;
        delete fe.err.specialite;
        rendre();
      }
    },
    nouvelleFiche: function () { S.ui.feuille = { type: 'fiche', titre: 'Nouveau contact', pleine: true, etape: 0, cherche: true, nouveau: true, d: brouillonFiche(''), err: {} }; rendre(); setTimeout(function () { var i = document.querySelector('.fx-champ-g'); if (i) i.focus(); }, 250); },
    // 3.27.1 : personne introuvable dans la base : on passe à la fiche (1. Où et quand)
    ficheCreer: function () {
      var f = S.ui.feuille; if (!f) return;
      if (String(f.d.nom || '').trim().length < 2) { f.err = { nom: 'Indiquez le nom (2 caractères min.).' }; rendre(); focusErreur(); return; }
      f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom;
      f.cherche = false; f.err = {}; f.etape = 0; f.lieuOuvert = 0; synchroniserDefautsFiche(f.d); rendre();
    },
    ficheIci: function () {
      var f = S.ui.feuille, e = f && f.ici; if (!e) return;
      var d = f.d, i = d.lieux.map(function (l) { return String(l.lieu || '').trim().length < 2; }).indexOf(true);
      if (i < 0) { var nl = lieuVide(false); nl.jours.forEach(function (j) { j.matin = false; j.soir = false; }); d.lieux.push(nl); i = d.lieux.length - 1; }
      var l = d.lieux[i]; l.lieu = e.lieu; l.quartier = e.quartier || l.quartier; l.commune = e.commune || l.commune; l.lat = e.lat; l.lon = e.lon;
      ['lieu', 'quartier'].forEach(function (k) { delete f.err[k + i]; });
      f.lieuOuvert = i; f.ici = null; rendre(); toast('Lieu : ' + e.lieu + '.');
    },
    // 3.27.4 : « Suivant » vérifie d'abord l'étape en cours
    ficheSuivant: function (el) {
      var f = S.ui.feuille; if (!f) return;
      if (f.etape === 0 && String(f.d.nom || '').trim().length >= 2) { f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom; }
      var e = erreursEtape(f.d, f.etape);
      if (Object.keys(e).length) { f.err = e; rendre(); focusErreur(); toast('Complétez les champs signalés.'); return; }
      ACTIONS.ficheAller(el);
    },
    ouvrirRappels: function () { S.ui.feuille = { type: 'rappels', titre: 'Rappels du jour' }; rendre(); },
    rappelAjouter: function (el) { S.ui.feuille = null; ACTIONS.visiteInopineeDirect({ dataset: { v: el.dataset.v } }); },
    rappelTraiter: function (el) {
      var m = LS.get('rappelsTraites', {}), k = el.dataset.k;
      m[k] = el.dataset.v === 'fait' ? { fait: true, le: aujourdhui() } : { jusqua: prochainJourOuvre(ajouterJours(aujourdhui(), 1)) };
      LS.set('rappelsTraites', m);
      toast(el.dataset.v === 'fait' ? 'Rappel retiré.' : 'Rappel reporté au ' + dateCourte(m[k].jusqua) + '.');
      if (!rappelsDuJour().length) S.ui.feuille = null;
      rendre();
    },
    ficheVoirSpecs: function () { var f = S.ui.feuille; if (f) { f.voirSpecs = !f.voirSpecs; rendre(); } },
    ficheIciNon: function () { var f = S.ui.feuille; if (f && f.ici) { f.iciRefuse = normaliser(f.ici.lieu); f.ici = null; rendre(); } },
    modifierFiche: function (el) {
      var code = el.dataset.v || S.ui.contactOuvert;
      if (!code) return;
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: (d.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
    },
    modifierActif: function () {
      var code = S.ui.contactOuvert;
      if (!code) {
        toast('Touchez d\'abord un médecin ou une pharmacie dans la liste.');
        return;
      }
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: d.nom || 'Modifier', pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
    },
    modifierPlanning: function (el) {
      var code = el.dataset.v || S.ui.contactOuvert;
      if (!code) return;
      var d = brouillonFiche(code);
      S.ui.feuille = {
        type: 'fiche',
        titre: d.type === 'Pharmacie' ? 'Horaires de réception' : 'Planning hebdomadaire',
        pleine: true,
        etape: 0, planningSeul: true,
        d: d,
        err: {},
        initial: JSON.stringify(d)
      };
      rendre();
    },
    ouvrirDoublon: function (el) {
      var d = brouillonFiche(el.dataset.v);
      S.ui.feuille = { type: 'fiche', titre: (d.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
      toast('Fiche existante ouverte : ' + d.nom);
    },
    majGpsDirect: function (el) {
      var code = el.dataset.v, d = brouillonFiche(code);
      if (!d || !d.code) return;
      var lieux = Array.isArray(d.lieux) ? d.lieux : [];
      if (lieux.length > 1) {
        S.ui.feuille = {
          type: 'choixLieuGps',
          titre: 'Capter position GPS',
          code: code,
          d: d
        };
        rendre();
        return;
      }
      majGpsPourLieu(code, 0);
    },
    majGpsLieuDirect: function (el) {
      var code = el.dataset.v, idx = parseInt(el.dataset.i, 10);
      majGpsPourLieu(code, isNaN(idx) ? 0 : idx);
    },
    capterGpsLieu: function (el) {
      var code = el.dataset.v, idx = parseInt(el.dataset.i, 10);
      S.ui.feuille = null;
      majGpsPourLieu(code, isNaN(idx) ? 0 : idx);
    },
    ficheVal: function (el) {
      var d = S.ui.feuille.d, k = el.dataset.k;
      d[k] = k === 'note' ? +el.dataset.v : el.dataset.v;
      if (k === 'type') {
        synchroniserDefautsFiche(d);
        S.ui.feuille.err = {};
      }
      rendre();
    },
    ficheJour: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], j = l.jours[+el.dataset.j];
      j[el.dataset.c] = !j[el.dataset.c];
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 1);
      rendre();
    },
    ficheAbsence: function () { var f = S.ui.feuille; if (!f) return; f.voirAbsence = !f.voirAbsence; rendre(); },
    ficheJoursTous: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], c = el.dataset.c;
      if (c === 'tout') {
        var tout = l.jours.every(function (j) { return j.matin && j.soir; });
        l.jours.forEach(function (j) { j.matin = !tout; j.soir = !tout; });
      } else {
        var tous = l.jours.every(function (j) { return j[c]; });
        l.jours.forEach(function (j) { j[c] = !tous; });
      }
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 1);
      rendre();
    },
    ficheOuvrirLieu: function (el) {
      var f = S.ui.feuille;
      if (f) { f.lieuOuvert = +el.dataset.i; rendre(); }
    },
    ficheReplierLieu: function () {
      var f = S.ui.feuille;
      if (f) { f.lieuOuvert = -1; rendre(); }
    },
    ficheEditerLieu0: function () {
      var f = S.ui.feuille;
      if (f) { f.editerLieu0 = !f.editerLieu0; rendre(); }
    },
    effacerVisiteChoix: function (el) {
      if (el.dataset.v === 'supprimer') { var f0 = S.ui.feuille, a0 = f0 && arret(f0.uid); S.ui.feuille = null; if (a0) supprimerVisiteJour(a0); else rendre(); return; }
      var f = S.ui.feuille, a = f && arret(f.uid); S.ui.feuille = null; if (!a) { rendre(); return; }
      if (el.dataset.v === 'supprimer') {
        S.queue = S.queue.filter(function (v) { return v.uid !== a.uid; });
        S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; }); S.horsPlan = (S.horsPlan || []).filter(function (x) { return x.uid !== a.uid; });
        LS.set('horsPlan', S.horsPlan); S.ui.aPublier = true; LS.set('aPublier', true); sauver(); rendre(); toast('Visite supprimée de la journée.');
        if (connecte()) synchroniser(true);
      } else effacerCr(a);
    },
    ficheChoixQuartier: function (el) {
      var f = S.ui.feuille, i = +el.dataset.i; if (!f || f.type !== 'fiche' || !f.d.lieux[i]) return;
      var q = quartiers().filter(function (x) { return x.quartier === el.dataset.v; })[0];
      f.d.lieux[i].quartier = el.dataset.v; if (q) f.d.lieux[i].commune = q.commune; delete f.err['quartier' + i];
      rendre(); toast('Quartier : ' + el.dataset.v + (q ? ', ' + q.commune : '') + '.');
    },
    ficheAjouterLieu: function () {
      var f = S.ui.feuille;
      if (f && f.d && f.d.lieux) {
        var nl = lieuVide(false); if (f.d.type !== 'Pharmacie') nl.jours.forEach(function (j) { j.matin = false; j.soir = false; });
        f.d.lieux.push(nl);
        f.lieuOuvert = f.d.lieux.length - 1;
        rendre();
      }
    },
    ficheRetirerLieu: function (el) {
      var f = S.ui.feuille;
      if (f && f.d && f.d.lieux) {
        f.d.lieux.splice(+el.dataset.i, 1);
        if (f.lieuOuvert >= f.d.lieux.length) f.lieuOuvert = Math.max(0, f.d.lieux.length - 1);
        S.ui.feuille.err = {};
        rendre();
      }
    },
    ficheChoixLieu: function (el) {
      var f = S.ui.feuille, i = +el.dataset.i, e = ((S.ui.sugLieux || {})[i] || [])[+el.dataset.v]; if (!f || !e) return;
      var l = f.d.lieux[i]; l.lieu = e.lieu; delete f.err['lieu' + i];
      // 3.26.59 : établissement connu : repères repris de la base
      if (!l.reperes) { var pR = (S.data.presences || []).filter(function (x) { return x.reperes && normaliser(x.lieu) === normaliser(e.lieu); })[0]; if (pR) l.reperes = pR.reperes; }
      var qVal = e.quartier, cVal = e.commune, latVal = e.lat, lonVal = e.lon;
      if (!qVal || /^NL$/i.test(qVal)) {
        var can = trouverEtablissementBDD(e.lieu, '', cVal);
        if (can && can.quartier && !/^NL$/i.test(can.quartier)) {
          qVal = can.quartier;
          if (can.commune && !cVal) cVal = can.commune;
          if (can.lat && !latVal) { latVal = can.lat; lonVal = can.lon; }
        }
      }
      if (qVal && !/^NL$/i.test(qVal)) {
        l.quartier = qVal;
        delete f.err['quartier' + i];
      }
      if (cVal) l.commune = cVal;
      if (!l.commune && l.quartier) {
        var qObj = quartiers().filter(function (q) { return normaliser(q.quartier) === normaliser(l.quartier); })[0];
        if (qObj && qObj.commune) l.commune = qObj.commune;
      }
      if (latVal && lonVal) { l.lat = latVal; l.lon = lonVal; }
      rendre(); toast('Établissement repris : ' + e.lieu + (l.quartier ? ' (' + l.quartier + ')' : '') + '.');
    },
    ficheGps: function (el) {
      var idx = +el.dataset.i;
      var f = S.ui.feuille;
      if (!f || !f.d || !f.d.lieux || !f.d.lieux[idx]) return;
      var l = f.d.lieux[idx];
      if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
      toast('Recherche de votre position précise…');
      mesurePrecise(function (p) {
        var avant = lireCoord(l);
        var pCapt = { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), prec: p.prec };

        // Référence géographique : quartier sélectionné ou position existante
        var qDecl = l.quartier ? quartiers().filter(function (q) { return q.quartier === l.quartier; })[0] : null;
        var refGeo = qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : avant;
        var nomLieuRef = l.quartier || l.commune || (f.d.nom ? f.d.nom : 'l\'établissement');
        var distanceKmEcart = refGeo && isFinite(refGeo.lat) ? distanceVol(pCapt, refGeo) : 0;

        function appliquerGps() {
          l.lat = pCapt.lat; l.lon = pCapt.lon; l.prec = pCapt.prec;
          var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
          if (r && r.quartier) {
            l.quartier = r.quartier.quartier;
            l.commune = r.quartier.commune;
            if (S.ui.feuille && S.ui.feuille.err) delete S.ui.feuille.err['quartier' + idx];
          }
          rendre();
          toast('GPS capté : ' + (l.quartier ? l.quartier + ' (± ' + p.prec + ' m)' : '± ' + p.prec + ' m') + '.');
        }

        if (refGeo && distanceKmEcart > 3) {
          var distArr = Math.round(distanceKmEcart);
          var fSauve = JSON.parse(JSON.stringify(f));
          confirmerPuis('Écart de position important',
            '<div style="color:var(--primaire,#0A6C74);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieuRef) + ' !</div>' +
            '<p style="margin:0 0 8px">Ce bouton sert uniquement lorsque vous êtes <b>physiquement devant l\'officine ou l\'établissement</b>.</p>' +
            '<p style="margin:0">Voulez-vous vraiment écraser la position ?</p>',
            'Écraser la position',
            function () {
              S.ui.feuille = fSauve;
              var lSauve = S.ui.feuille.d.lieux[idx];
              lSauve.lat = pCapt.lat; lSauve.lon = pCapt.lon; lSauve.prec = pCapt.prec;
              var r = Moteur.quartierLePlusProche(lSauve.lat, lSauve.lon, quartiers());
              if (r && r.quartier) {
                lSauve.quartier = r.quartier.quartier;
                lSauve.commune = r.quartier.commune;
                if (S.ui.feuille.err) delete S.ui.feuille.err['quartier' + idx];
              }
              rendre();
              toast('Position GPS mise à jour (' + distArr + ' km).');
            },
            function () {
              S.ui.feuille = fSauve;
              rendre();
              toast('Position inchangée.');
            }
          );
          return;
        }

        appliquerGps();
      }, function () { toast('Position indisponible. Autorisez la localisation.'); });
    },
    ficheGpsEffacer: function (el) { var l = S.ui.feuille.d.lieux[+el.dataset.i]; l.lat = ''; l.lon = ''; rendre(); },
    ficheAller: function (el) {
      var f = S.ui.feuille, cible = +el.dataset.v;
      f.err = {};
      f.etape = Math.max(0, Math.min(1, cible));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEtape: function (el) {
      var f = S.ui.feuille, sens = +el.dataset.v;
      f.err = {};
      f.etape = Math.max(0, Math.min(1, f.etape + sens));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEnregistrer: function () {
      var f = S.ui.feuille;
      var nomInit = f.initial ? JSON.parse(f.initial).nom : null;
      if (String(f.d.nom || '').trim().length >= 2 && f.d.nom !== nomInit) { f.d.nom = nomAvecTitre(f.d.nom, f.d.type); if (f.d.type === 'Pharmacie') f.d.lieux[0].lieu = f.d.nom; }
      synchroniserDefautsFiche(f.d);
      for (var i = 0; i < 2; i++) {
        var e = erreursEtape(f.d, i);
        if (Object.keys(e).length) { f.err = e; var kL = Object.keys(e).map(function (x) { var m2 = x.match(/^(?:lieu|quartier|jours|hm|hs)(\d+)$/); return m2 ? +m2[1] : -1; }).filter(function (x) { return x >= 0; })[0]; f.etape = i; if (kL !== undefined) { f.lieuOuvert = kL; if (i === 1) f.etape = 1; } rendre(); focusErreur(); toast('Complétez les champs signalés.'); return; }
      }
      if (!f.d.code && !f.doublonConfirme) {
        var doublons = chercherDoublonsFiche(f.d).filter(function (x) { return x.bloquant; });   // 3.27.28 : même nom, même téléphone, ou nom proche au même endroit
        if (doublons.length) {
          var ex = doublons[0].p, fSauve = JSON.parse(JSON.stringify(f));
          confirmerPuis('Doublon potentiel',
            '<b>' + esc(ex.nom) + '</b> (' + esc(doublons[0].lieu || ex.specialite) + ') existe déjà sous le code <b>' + esc(ex.code) + '</b>.<br>Voulez-vous compléter sa fiche au lieu de créer un doublon ?',
            'Compléter sa fiche',
            function () {
              var dEx = brouillonFiche(ex.code);
              S.ui.feuille = { type: 'fiche', titre: (dEx.type === 'Pharmacie' ? 'Modifier la pharmacie' : 'Modifier le médecin'), pleine: true, etape: 1, d: dEx, err: {}, initial: JSON.stringify(dEx) };
              rendre();
            },
            function () {
              fSauve.doublonConfirme = true;
              S.ui.feuille = fSauve;
              ACTIONS.ficheEnregistrer();
            });
          return;
        }
      }
      if (f.initial && f.initial === JSON.stringify(f.d)) { S.ui.feuille = null; rendre(); toast('Aucune modification.'); return; }
      var nouveau = !f.d.code, code = enregistrerFiche(f.d);
      S.ui.feuille = null; S.ui.contactOuvert = code; S.ui.contactEnTete = code; S.ui.tab = 'praticiens'; S.ui.recherche = ''; rendre();
      toast((nouveau ? 'Praticien ajouté' : 'Fiche mise à jour') + (S.config.demo ? '.' : (navigator.onLine ? ', envoi au Google Sheet…' : ', envoi dès le retour du réseau.')));
      if (!S.config.demo) synchroniser(true);
    },
    // Statistiques
    statsPeriode: function (el) { S.ui.stats.periode = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsPortee: function (el) { S.ui.stats.portee = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    statsVue: function (el) { S.ui.statsVue = el.dataset.v; LS.set('statsVue', S.ui.statsVue); rendre(); },
    statsSpec: function (el) { S.ui.stats.vueSpec = el.dataset.v; LS.set('stats', S.ui.stats); rendre(); },
    // Apparence, lancement, mises à jour
    theme: function (el) { appliquerTheme(el.dataset.v); rendre(); },
    fermerLancement: function (el) {
      S.ui.lancement = false; S.ui.lancementAuto = false;
      if (el.dataset.tab && pret()) S.ui.tab = el.dataset.tab;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
    },
    ouvrirLancement: function () { S.ui.lancement = true; S.ui.lancementAuto = false; rendre(); },
    appliquerMaj: appliquerMaj,
    plusTardMaj: function () { $('bandeauMaj').hidden = true; },
    verifierMaj: function () {
      if (!swReg) { toast('Mises à jour indisponibles dans ce navigateur.'); return; }
      toast('Recherche d\'une mise à jour…');
      swReg.update().then(function () {
        setTimeout(function () { if (!swReg.waiting && !swReg.installing) toast('MediPlanner est à jour (version ' + APP_VERSION + ').'); }, 2500);
      }, function () { toast('Vérification impossible hors ligne.'); });
    },
    partager: function () {
      var lien = lienInstallation(), texte = 'MediPlanner : ouvrez ce lien sur votre téléphone, puis installez l\'application.';
      if (navigator.share) navigator.share({ title: 'MediPlanner', text: texte, url: lien }).catch(function () {});
      else copier(lien);
    }
  };

  function memoriserPouceY(e) {
    if (!e) return;
    var y = null;
    if (typeof e.clientY === 'number' && e.clientY > 0) {
      y = e.clientY;
    } else if (e.touches && e.touches[0] && typeof e.touches[0].clientY === 'number') {
      y = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches[0] && typeof e.changedTouches[0].clientY === 'number') {
      y = e.changedTouches[0].clientY;
    }
    if (y && y > 0) {
      S.ui.dernierClicY = Math.round(y);
    }
  }

  document.addEventListener('click', function (e) {
    memoriserPouceY(e);
    var el = e.target.closest('[data-a]');
    if (!el || !ACTIONS[el.dataset.a] || el.disabled) return;
    if (el.__bloqueClic && Date.now() < el.__bloqueClic) {
      e.preventDefault();
      return;
    }
    if (el.tagName === 'A') return;
    e.preventDefault();
    ACTIONS[el.dataset.a](el, e);
  });
  window.addEventListener('pointerdown', memoriserPouceY, { passive: true, capture: true });
  window.addEventListener('touchstart', memoriserPouceY, { passive: true, capture: true });
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f, pos;
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'cr') { var ac = arret(el.dataset.uid); if (ac) majCr(ac, el.dataset.k, el.value); }
    if (f === 'fiche') {
      majChampFiche(el, false);
      if (el.dataset.k === 'lieu') {
        var zpL = document.getElementById('presentsIci'); if (zpL && S.ui.feuille && S.ui.feuille.d) zpL.innerHTML = rendrePresentsIci(S.ui.feuille.d);
        var idxL = +el.dataset.i, valL = el.value.trim();
        var zs = document.getElementById('sugLieu' + idxL);
        if (zs) zs.innerHTML = suggestionsLieu(valL, idxL);
        if (valL.length >= 2 && S.ui.feuille && S.ui.feuille.d && S.ui.feuille.d.lieux[idxL]) {
          var lObj = S.ui.feuille.d.lieux[idxL];
          var bddMatch = trouverEtablissementBDD(valL, lObj.quartier, lObj.commune);
          if (bddMatch && bddMatch.quartier && !/^NL$/i.test(bddMatch.quartier)) {
            lObj.quartier = bddMatch.quartier;
            if (bddMatch.commune && !lObj.commune) lObj.commune = bddMatch.commune;
            if (bddMatch.lat && !lObj.lat) { lObj.lat = bddMatch.lat; lObj.lon = bddMatch.lon; }
            delete S.ui.feuille.err['quartier' + idxL];
            delete S.ui.feuille.err['lieu' + idxL];
            var qBtn = document.getElementById('ficheQuartier' + idxL + 'Btn');
            if (qBtn) {
              var sp = qBtn.querySelector('span');
              if (sp) sp.textContent = bddMatch.quartier + (lObj.commune ? ' (' + lObj.commune + ')' : '');
              qBtn.removeAttribute('aria-invalid');
            }
            if (S.ui.listes && S.ui.listes['ficheQuartier' + idxL]) {
              S.ui.listes['ficheQuartier' + idxL].valeur = bddMatch.quartier;
            }
            var errQ = document.getElementById('err-quartier' + idxL);
            if (errQ) errQ.textContent = '';
          }
        }
      }
      if (el.dataset.k === 'nom' || el.dataset.k === 'telephone') {
        if (S.ui.feuille && S.ui.feuille.d && S.ui.feuille.d.type === 'Pharmacie' && el.dataset.k === 'nom') S.ui.feuille.d.lieux[0].lieu = el.value;
        var zd = document.getElementById('doublonsFiche'); if (zd && S.ui.feuille) zd.innerHTML = rendreDoublonsFiche(S.ui.feuille.d);
        var zp = document.getElementById('presentsIci'); if (zp && S.ui.feuille) zp.innerHTML = rendrePresentsIci(S.ui.feuille.d);
        var zc = document.getElementById('ficheCreerNom'); if (zc && S.ui.feuille) zc.textContent = nomCreer(S.ui.feuille.d);
      }
    }
    if (f === 'produits') {
      var ap = arret(el.dataset.uid), ref = ap ? produitsPour(ap) : produitsRef();
      if (ap) { ap.produits = listeProduits(ap.produits).filter(function (x) { return ref.indexOf(x) >= 0; }).concat(listeProduits(el.value)).join(', '); LS.set('plan', S.plan); }
    }
    if (f === 'rechCommunes' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zc = document.getElementById('resCommunes'); if (zc) zc.innerHTML = resultatsCommunes(el.value);
    }
    if (f === 'rechTout' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zt = document.getElementById('resTout'); if (zt) zt.innerHTML = resultatsTout(el.value);
    }
    if (f === 'rechAutourLibre') {
      S.ui.rechAutourLibre = el.value; var za = document.getElementById('resAutourLibre'), zl = document.getElementById('autourListe');
      if (za) za.innerHTML = resultatsAutourLibre(el.value); if (zl) zl.hidden = !!normaliser(el.value);
    }
    if (f === 'rechAjout' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zr = document.getElementById('resAjout'); if (zr) zr.innerHTML = resultatsAjout(el.value);
    }
    if (f === 'rechRemplacer' && S.ui.feuille) {
      S.ui.feuille.q = el.value;
      var aR = arret(S.ui.feuille.uid);
      var cands = aR ? candidatsRemplacement(aR) : [];
      var zrR = document.getElementById('resRemplacer');
      if (zrR) zrR.innerHTML = listeCandidatsRemplacementHtml(S.ui.feuille, cands, el.value);
    }
    if (f === 'chercheOption') {
      var fe = S.ui.feuille; fe.q = fe.q || {}; fe.q[el.dataset.g] = el.value;
      var grp = el.closest('.groupe-filtre');
      if (grp && !grp.classList.contains('ouvert') && el.value) {   // 3.27.27 : recherche tapée dans un groupe replié : il s'ouvre
        var gId = el.dataset.g, pos = el.selectionStart;
        fe.ouverts = fe.ouverts || {}; fe.ouverts[gId] = true; rendreFeuille();
        var ch = document.querySelector('.groupe-filtre[data-groupe="' + gId + '"] input[data-f="chercheOption"]');
        if (ch) { ch.focus(); try { ch.setSelectionRange(pos, pos); } catch (eS) {} ch.dispatchEvent(new Event('input', { bubbles: true })); }
        return;
      }
      var q = normaliser(el.value), g = el.closest('.groupe-filtre') || el.closest('.feuille-corps');
      if (g) {
        g.querySelectorAll('.puce').forEach(function (b) { b.hidden = !!q && b.dataset.lib && b.dataset.lib.indexOf(q) < 0; });
        g.querySelectorAll('.commune-parent-ligne').forEach(function (l) { var p = l.querySelector('.puce'); if (p) l.hidden = p.hidden; });
        g.querySelectorAll('.puces[data-ferme]').forEach(function (p) { p.hidden = !q && p.dataset.ferme === '1'; });
        var zAutres = g.querySelector('#autresSpecs'); if (zAutres && fe) zAutres.hidden = !q && !fe.autresOuvert;
        g.querySelectorAll('.section-choix').forEach(function (sec) {
          var puces = sec.querySelector('.puces');
          var aPuce = !q || !!sec.querySelector('.puce:not([hidden])');
          sec.hidden = !!q && !aPuce;
          var btn = sec.querySelector('.aire-bascule');
          if (btn) {
            var exp = q ? aPuce : (puces ? puces.dataset.ferme !== '1' : true);
            btn.setAttribute('aria-expanded', String(exp));
          }
          if (q) {
            sec.classList.toggle('ouverte', aPuce);
          } else if (puces) {
            sec.classList.toggle('ouverte', puces.dataset.ferme !== '1');
          }
        });
      }
    }
    if (f === 'jourDate' && el.value) { allerAuJour(el.value); return; }
    if (f === 'rapport') { var Rr = rapportOuCree(jourAffiche()); Rr[el.dataset.k] = el.value; sauverRapports(); return; }
    if (f === 'rechProduit') {
      S.ui.rechProduit = el.value; var pp = el.selectionStart; rendre();
      var cp = document.querySelector('[data-f="rechProduit"]'); if (cp) { cp.focus(); try { cp.setSelectionRange(pp, pp); } catch (x) {} }
    }
    if (f === 'rechHop') {   // 3.27.30 : recherche dans l'annuaire des hôpitaux
      S.ui.rechHop = el.value; S.ui.limite = 40; pos = el.selectionStart; rendre();
      var chH = document.querySelector('[data-f="rechHop"]'); if (chH) { chH.focus(); try { chH.setSelectionRange(pos, pos); } catch (x) {} }
    }
    if (f === 'recherche' || f === 'rechercheImpose') {
      if (f === 'recherche') { if (S.ui.tab === 'autour') S.ui.rechercheAutour = el.value; else S.ui.recherche = el.value; S.ui.limite = 40; } else S.ui.feuille.q = el.value;
      pos = el.selectionStart; rendre();
      var champ = document.querySelector('[data-f="' + f + '"]');
      if (champ) { champ.focus(); try { champ.setSelectionRange(pos, pos); } catch (x) {} }
    }
  });
  document.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (f === 'param') {
      var k = el.dataset.k;
      S.params[k] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? +el.value : el.value);
      if (k === 'dateRef' && S.params.dateRef && S.params.dateRef < aujourdhui() && (S.params.mode === 'jour' || joursOuvres(lundiDe(S.params.dateRef))[4] < aujourdhui())) {
        S.params.dateRef = aujourdhui(); toast('Impossible de planifier un jour passé : la date revient à aujourd\'hui.', 4000);
      }
      LS.set('params', S.params);
      if (k === 'dateRef' || k === 'parJour') rendre();
    }
    if (f === 'autour') { S.ui.autour[el.dataset.k] = el.value; LS.set('autour', S.ui.autour); rendre(); }
    if (f === 'crSelect') {
      var as = arret(el.dataset.uid);
      if (as) { majCr(as, el.dataset.k, el.value); if (el.dataset.k === 'date' && el.value) validerEtape(as, 'date'); rendre(); }
    }
    if (f === 'cr' && /^(autres)$/.test(el.dataset.k)) rendre();
    if (f === 'repriseCible' && el.value && S.ui.feuille) {
      S.ui.feuille.cible = el.value < aujourdhui() && (S.ui.feuille.source.type !== 'semaine' || joursOuvres(lundiDe(el.value))[4] < aujourdhui()) ? aujourdhui() : el.value;
      if (S.ui.feuille.cible !== el.value) toast('Impossible de reprendre sur un jour passé.', 3500);
      rendre();
    }
    if (f === 'eqDate' && el.value) { S.ui.eqDate = el.value; S.ui.jourEquipe = null; rendre(); }
    if (f === 'fiche') majChampFiche(el, true);
    if (f === 'prochaine') { var ax = arret(el.dataset.uid); if (ax) { ax.prochaine = el.value; LS.set('plan', S.plan); rendre(); } }
    if (f === 'importSecours' && el.files && el.files[0]) { importerSecours(el.files[0]); el.value = ''; }
    if (f === 'saisieAvancee') { S.config.modifPasse = S.config.saisieFutur = el.checked; LS.set('config', S.config); toast(el.checked ? 'Saisie avancée activée : jours passés et à venir modifiables.' : 'Saisie avancée désactivée : seul le jour même se saisit.'); rendre(); }
    if (f === 'crExpress') { S.config.crExpress = el.checked; LS.set('config', S.config); toast(el.checked ? 'Compte rendu express activé : saisie rapide en 1 écran.' : 'Compte rendu express désactivé : saisie complète par étapes.'); rendre(); }
    if (f === 'saisieFutur') { S.config.saisieFutur = el.checked; LS.set('config', S.config); toast(el.checked ? 'Saisie des jours à venir activée.' : 'Jours à venir en aperçu seul.'); }
    if (f === 'modifPasse') { S.config.modifPasse = el.checked; LS.set('config', S.config); toast(el.checked ? 'Modification des jours passés activée.' : 'Jours passés en lecture seule.'); }
    if (f === 'choixNom') { var bloc = $(el.id + 'Bloc'); if (bloc) bloc.hidden = el.value !== '__autre'; }
    if (f === 'tri') { S.ui.tri = el.value; LS.set('tri', S.ui.tri); rendre(); }
    if (f === 'stats') {
      var k2 = el.dataset.k;
      S.ui.stats[k2] = k2 === 'objectif' ? Math.max(1, Math.min(200, +el.value || 40)) : el.value;
      LS.set('stats', S.ui.stats); rendre();
    }
    if (f === 'autourQuartier' && el.value) {
      var q = quartiers().filter(function (x) { return x.quartier === el.value; })[0];
      if (q) { S.ui.autour.lat = q.lat; S.ui.autour.lon = q.lon; S.ui.autour.label = q.quartier; S.ui.autour.src = 'quartier'; LS.set('autour', S.ui.autour); rendre(); }
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.ui.feuille) { S.ui.feuille = null; rendre(); }
    else if (S.ui.lancement) { S.ui.lancement = false; S.ui.lancementAuto = false; rendre(); }
  });

  // Saisie dans l'assistant : mise à jour du brouillon, validation dynamique au changement de champ
  function majChampFiche(el, change) {
    var f = S.ui.feuille; if (!f || f.type !== 'fiche') return;
    var d = f.d, k = el.dataset.k, i = el.dataset.i;
    var v = el.type === 'checkbox' ? (el.checked ? 'Oui' : 'Non') : el.value;
    if (k === 'telephone' && change) {
      var telFmt = formaterTelephoneCI(v);
      if (telFmt) { v = telFmt; el.value = telFmt; }
    }
    if (i !== undefined) d.lieux[+i][k] = v; else d[k] = v;
    if (!change) return;
    if (k === 'lieu' && d.type !== 'Pharmacie' && i !== undefined) {
      // Auto-correction vers l'écriture officielle et récupération automatique du quartier / GPS depuis la BDD
      var can = trouverEtablissementBDD(v, d.lieux[+i].quartier, d.lieux[+i].commune);
      if (can) {
        d.lieux[+i].lieu = can.lieu;
        if (can.quartier && !/^NL$/i.test(can.quartier)) {
          d.lieux[+i].quartier = can.quartier;
          delete f.err['quartier' + i];
        }
        if (can.commune && !/^NL$/i.test(can.commune)) d.lieux[+i].commune = can.commune;
        if (can.lat && can.lon) { d.lieux[+i].lat = can.lat; d.lieux[+i].lon = can.lon; }
        // 3.27.4 : repères et GPS des autres praticiens du même établissement
        var ib = infosLieuBase(can.lieu);
        if (!d.lieux[+i].reperes && ib.reperes) d.lieux[+i].reperes = ib.reperes;
        if (ib.lat && !(can.lat && can.lon)) { d.lieux[+i].lat = ib.lat; d.lieux[+i].lon = ib.lon; }
        delete f.err['lieu' + i];
        rendre();
        return;
      }
    }
    if (k === 'specialite' || k === 'quartier') {
      // liste déroulante : nouvel affichage (champ « Autre », commune), en gardant les erreurs déjà signalées
      var tous = Object.assign(erreursEtape(d, 0), erreursEtape(d, 1)), cleS = k === 'quartier' ? 'quartier' + i : 'specialite', garde = {};
      Object.keys(f.err).forEach(function (x) { if (tous[x]) garde[x] = tous[x]; });
      if (tous[cleS]) garde[cleS] = tous[cleS];
      f.err = garde; rendre(); return;
    }
    var cle = { lieu: 'lieu', horaireMatin: 'hm', horaireSoir: 'hs' }[k];
    cle = cle ? cle + i : k;
    var err = Object.assign(erreursEtape(d, 0), erreursEtape(d, 1))[cle] || '';
    if (err) f.err[cle] = err; else delete f.err[cle];
    var span = document.getElementById('err-' + cle);
    if (span) span.textContent = err;
    if (err) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  }
  function focusErreur() {
    var el = document.querySelector('.feuille [aria-invalid="true"]');
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
    else { var s = document.querySelector('.feuille .erreur:not(:empty), .feuille .erreur-texte'); if (s) s.scrollIntoView({ block: 'center' }); }
  }

