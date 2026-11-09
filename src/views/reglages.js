  VUES.reglages = function () {
    // 3.28.39 : quatre volets repliables, seul « Mon profil » ouvert par défaut ; ce que l'on ouvre reste ouvert pendant la session
    var c = S.config, ouv = S.ui.regOuverts || (S.ui.regOuverts = { profil: true, avance: (!c.url && !c.demo) || !!S.ui.erreur });
    function volet(id, titre, resume, corps) {
      return '<details class="bloc avance reg-volet" data-reg="' + id + '"' + (ouv[id] ? ' open' : '') + '><summary><b>' + titre + '</b><span class="discret">' + resume + '</span></summary>' + corps + '</details>';
    }
    var h = '<h2 class="titre-vue">Réglages</h2><p class="sous-titre">Touchez un titre pour l\'ouvrir.</p>';
    // 1. Mon profil
    h += volet('profil', 'Mon profil', esc(c.delegue || 'Votre nom, WhatsApp, quartier'),
      champNom('cfgNom', c.delegue || '', 'Votre nom (visible par vos collègues)') +
      '<label class="champ"><span>Votre numéro WhatsApp</span><input type="tel" id="cfgWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07" value="' + esc(c.whatsapp || '') + '"></label>' +
      '<div class="champ"><span>Mon quartier (départ des tournées)</span>' + selecteurListe('cfgDepart', { titre: 'Mon quartier', dom: true, valeur: c.depart || '', vide: 'Choisir un quartier…', sections: sectionsQuartiers() }) + '</div>' +
      '<label class="champ"><span>WhatsApp de mon superviseur</span><input type="tel" id="cfgWaResp" inputmode="tel" placeholder="Facultatif" value="' + esc(c.waResp || '') + '"></label>' +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="enregistrerMoi">Enregistrer</button>');
    // 2. Préférences : s'appliquent tout de suite
    var nOk = typeof Notification !== 'undefined', nPerm = nOk ? Notification.permission : 'denied', nAct = LS.get('notifs', false) && nPerm === 'granted';
    var hNotif = '<h3>Notifications</h3>' +
      '<p class="discret" style="margin:0 0 8px">Pharmacie ou médecin du jour à moins de 500 m, médecin aussi prévu par un collègue. Affichées quand l\'application est ouverte ou vient d\'être mise en arrière-plan.</p>' +
      (!nOk ? '<p class="discret">Ce navigateur ne gère pas les notifications. Installez l\'application depuis Chrome.</p>' :
        nPerm === 'denied' ? '<p class="discret">Notifications bloquées : autorisez-les dans les réglages du navigateur (cadenas › Autorisations › Notifications).</p>' :
        '<button class="bouton bouton-large' + (nAct ? '' : ' bouton-plein') + '" type="button" data-a="notifBascule">' + (nAct ? 'Désactiver les notifications' : 'Activer les notifications') + '</button>' +
        (nAct ? '<button class="bouton-texte" type="button" data-a="notifTest" style="display:block;margin:8px auto 0">Envoyer une notification d\'essai</button>' : '')) +
      '';
    var th = LS.get('theme', 'clair');
    var hTheme = '<h3 style="margin-top:4px">Apparence</h3><div class="segment" role="group" aria-label="Thème" style="margin:0">' +
      [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(function (x) {
        return '<button type="button" data-a="theme" data-v="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><p class="discret" style="margin:8px 0 0">Auto suit le réglage du téléphone.</p>';
    h += volet('pref', 'Préférences', 'Apparence, comptes rendus, WhatsApp, notifications',
      hTheme +
      '<h3>Comptes rendus</h3><label class="interrupteur" style="margin-top:0"><span>Compte rendu express<small class="discret bloc-texte">Saisie rapide des visites de routine sur un seul écran (statut, types, produits et prochain RDV). Le formulaire complet reste accessible d\'un clic.</small></span>' +
        '<input type="checkbox" data-f="crExpress"' + (c.crExpress ? ' checked' : '') + '></label>' +
      '<label class="interrupteur"><span>Saisie avancée<small class="discret bloc-texte">Comptes rendus des jours passés et à venir. Désactivée : seul le jour même se saisit ; la planification des jours à venir reste possible.</small></span>' +
        '<input type="checkbox" data-f="saisieAvancee"' + (c.modifPasse && c.saisieFutur ? ' checked' : '') + '></label>' +
      '<h3>WhatsApp</h3><label class="interrupteur" style="margin-top:0"><span>Toujours ouvrir WhatsApp Web<small class="discret bloc-texte">Pour envoyer depuis un ordinateur.</small></span><input type="checkbox" id="cfgWaWeb" data-f="waWeb"' + (c.waWeb ? ' checked' : '') + '></label>' +
      hNotif);
    // 3. Application
    var hInst = estInstallee() ?
      '<button class="bouton bouton-large" type="button" disabled aria-disabled="true">' + icone('valider') + 'Application installée</button>' :
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">' + icone('telecharger') + 'Installer l\'application</button>';
    h += volet('appli', 'Application', 'Version ' + APP_VERSION + ', mises à jour, installation, partage',
      '<h3 style="margin-top:4px">Version ' + APP_VERSION + '</h3><p class="discret" style="margin-top:0">Les mises à jour sont signalées par un bandeau en haut de l\'écran ; vos données restent sur le téléphone.</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="verifierMaj">Recherche MàJ</button>' +
      '<button class="bouton" type="button" data-a="ouvrirLancement">Écran d\'accueil</button></div>' +
      '<h3>Installer sur le téléphone</h3>' + hInst +
      (connecte() ? '<h3>Partager avec un collègue</h3>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="partager" style="margin-bottom:6px">Partager l\'application</button>' +
        '<p class="discret" style="margin:0">Le lien installe et règle l\'application chez votre collègue ; il donne accès à la base : envoyez-le uniquement à vos collègues.</p>' : ''));
    // 4. Avancé : données du téléphone, base, connexion, effacement
    // 3.28.12 : Supabase base principale, Google Sheets en appoint, synchronisés dans les deux sens
    var bddSrc = (S.config && S.config.bddSource) || 'supabase';
    var hBdd = '<h3>Base de données</h3>' +
      '<p class="discret" style="margin:0 0 10px">Supabase est la base principale. Chaque enregistrement est écrit dans Supabase et dans Google Sheets à la même seconde ; une modification faite directement dans l\'une des deux bases est reportée dans l\'autre en 5 minutes au plus.</p>' +
      '<div class="segment" role="group" aria-label="Base de données" style="margin:0 0 10px">' +
      '<button type="button" data-a="basculerSourceBdd" data-v="sheets" aria-pressed="' + (bddSrc === 'sheets') + '">Google Sheets (appoint)</button>' +
      '<button type="button" data-a="basculerSourceBdd" data-v="supabase" aria-pressed="' + (bddSrc === 'supabase') + '">Supabase (Défaut)</button>' +
      '</div>' +
      '<div style="font-size:12.5px;color:var(--texte-discret);margin-bottom:10px">' +
      (bddSrc === 'sheets' ?
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3B82F6;margin-right:6px"></span><b>Google Sheets actif :</b> lecture de secours (la base est identique).' :
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px"></span><b>Supabase actif :</b> base principale, chargement rapide.') +
      '</div>' +
      etatJumelageHtml() +
      '<button class="bouton bouton-large" type="button" data-a="testerSupabase">Vérifier la synchronisation</button>';
    h += volet('avance', 'Avancé', 'Synchronisation, sauvegarde, base de données, connexion, effacement',
      '<h3 style="margin-top:4px">Synchronisation</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') +
      (S.fiches.length ? ' ' + S.fiches.length + ' fiche(s) praticien en attente' + (S.ui.serveurAncien ? ' : le serveur Apps Script doit être mis à jour pour les recevoir.' : '.') : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' +
        '<button class="bouton bouton-large" type="button" data-a="rechargerBase" style="margin-bottom:10px">Recharger toute la base</button>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<h3>Sauvegarde</h3><p class="discret" style="margin-top:0">' +
        (S.data && S.data.sauvegarde ? 'Base : dernière copie le ' + new Date(S.data.sauvegarde).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (7 copies dans Drive).' : 'Base : sauvegarde quotidienne à installer dans la BDD (menu MediPlanner › Sauvegardes).') +
        ' Téléphone : ' + Object.keys(LS.get('secours', {})).length + ' copie(s) sur 7 jours.</p>' +
      '<div class="rangee" style="margin-bottom:10px"><button class="bouton" type="button" data-a="exporterSecours">' + icone('telecharger') + 'Exporter</button>' +
        '<label class="bouton" style="position:relative;overflow:hidden">' + icone('relancer') + 'Importer<input type="file" accept="application/json,.json" data-f="importSecours" style="position:absolute;inset:0;opacity:0"></label></div>' +
      hBdd +
      '<h3>Connexion au serveur</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      (S.data && S.data.praticiens && !S.data.serveurRecent && connecte() ? '<p class="discret" style="color:var(--rouge)">Ce téléphone est relié à une ancienne version du serveur : touchez « Synchroniser maintenant » pour basculer automatiquement sur le serveur à jour.</p>' : '') +
      (connecte() ? '<p class="discret" style="margin:4px 0 0">Serveur : …' + esc(String(S.config.url).replace(/\/exec.*$/, '').slice(-6)) + '</p>' : '') +
      '<h3>Effacer</h3><button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button>');
    return h;
  };
