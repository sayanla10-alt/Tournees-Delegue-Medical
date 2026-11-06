  VUES.reglages = function () {
    var c = S.config;
    var qOpts = '<option value="">Aucun (début à la première visite)</option>' + quartiers().map(function (q) {
      return '<option' + (q.quartier === c.depart ? ' selected' : '') + '>' + esc(q.quartier) + '</option>';
    }).join('');
    var h = '<h2 class="titre-vue">Réglages</h2><p class="sous-titre">Votre profil, l\'apparence, le partage et l\'installation de l\'application.</p>';
    h += '<section class="bloc"><h3 style="margin-top:0">Mon profil</h3>' +
      champNom('cfgNom', c.delegue || '', 'Votre nom (visible par vos collègues)') +
      '<label class="champ"><span>Votre numéro WhatsApp</span><input type="tel" id="cfgWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07" value="' + esc(c.whatsapp || '') + '"></label>' +
      '<label class="champ"><span>WhatsApp Superviseur</span><input type="tel" id="cfgWaResp" inputmode="tel" placeholder="Facultatif" value="' + esc(c.waResp || '') + '"></label>' +
      '<label class="interrupteur"><span>Toujours ouvrir WhatsApp Web</span><input type="checkbox" id="cfgWaWeb"' + (c.waWeb ? ' checked' : '') + '></label>' +
      '<div class="champ"><span>Mon quartier</span>' + selecteurListe('cfgDepart', { titre: 'Mon quartier', dom: true, valeur: c.depart || '', vide: 'Choisir un quartier…', sections: sectionsQuartiers() }) + '</div>' +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="enregistrerMoi">Enregistrer</button></section>';
    // 3.26.73 : notifications du téléphone
    var nOk = typeof Notification !== 'undefined', nPerm = nOk ? Notification.permission : 'denied', nAct = LS.get('notifs', false) && nPerm === 'granted';
    h += '<section class="bloc"><h3 style="margin-top:0">Notifications</h3>' +
      '<p class="discret" style="margin:0 0 8px">Pharmacie ou médecin du jour à moins de 500 m, médecin aussi prévu par un collègue. Affichées quand l\'application est ouverte ou vient d\'être mise en arrière-plan.</p>' +
      (!nOk ? '<p class="discret">Ce navigateur ne gère pas les notifications. Installez l\'application depuis Chrome.</p>' :
        nPerm === 'denied' ? '<p class="discret">Notifications bloquées : autorisez-les dans les réglages du navigateur (cadenas › Autorisations › Notifications).</p>' :
        '<button class="bouton bouton-large' + (nAct ? '' : ' bouton-plein') + '" type="button" data-a="notifBascule">' + (nAct ? 'Désactiver les notifications' : 'Activer les notifications') + '</button>' +
        (nAct ? '<button class="bouton-texte" type="button" data-a="notifTest" style="display:block;margin:8px auto 0">Envoyer une notification d\'essai</button>' : '')) +
      '</section>';
    var th = LS.get('theme', 'clair');
    h += '<section class="bloc"><h3>Apparence</h3><div class="segment" role="group" aria-label="Thème" style="margin:0">' +
      [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(function (x) {
        return '<button type="button" data-a="theme" data-v="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><p class="discret" style="margin:8px 0 0">Auto suit le réglage du téléphone.</p></section>';

    // Base de données : Google Sheets par défaut, Supabase en miroir temps réel
    var bddSrc = (S.config && S.config.bddSource) || 'sheets';
    h += '<section class="bloc"><h3 style="margin-top:0">Base de données</h3>' +
      '<p class="discret" style="margin:0 0 10px">Google Sheets est la base principale par défaut. Vos visites, fiches et plannings sont également répliqués en continu vers Supabase (double écriture temps réel).</p>' +
      '<div class="segment" role="group" aria-label="Base de données" style="margin:0 0 10px">' +
      '<button type="button" data-a="basculerSourceBdd" data-v="sheets" aria-pressed="' + (bddSrc === 'sheets') + '">Google Sheets (Défaut)</button>' +
      '<button type="button" data-a="basculerSourceBdd" data-v="supabase" aria-pressed="' + (bddSrc === 'supabase') + '">Supabase (Rapide)</button>' +
      '</div>' +
      '<div style="font-size:12.5px;color:var(--texte-discret);margin-bottom:10px">' +
      (bddSrc === 'sheets' ?
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3B82F6;margin-right:6px"></span><b>Google Sheets actif :</b> Base de données principale.' :
        '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10B981;margin-right:6px"></span><b>Supabase actif :</b> Chargement ultra-rapide (~300 ms).') +
      '<br><span style="display:inline-block;margin-top:4px">Double écriture active : chaque visite, fiche ou planning est enregistré simultanément sur Google Sheets et Supabase.</span></div>' +
      '<button class="bouton bouton-large" type="button" data-a="testerSupabase">Tester la connexion Supabase</button></section>';

    if (connecte()) {
      h += '<section class="bloc"><h3 style="margin-top:0">Partager avec un collègue</h3>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="partager" style="margin-bottom:6px">Partager l\'application</button>' +
        '<p class="discret" style="margin:0">Le lien donne accès à la base : envoyez-le uniquement à vos collègues.</p></section>';
    }
    // 3.19.0 : un bouton, comme « Partager » ; masqué quand l'application est déjà installée
    // 3.24.13 : toujours visible ; déjà installée (ouverte depuis l'icône), le bouton le dit au lieu de disparaître
    h += '<section class="bloc"><h3 style="margin-top:0">Installer sur le téléphone</h3>' + (estInstallee() ?
      '<button class="bouton bouton-large" type="button" disabled aria-disabled="true">' + icone('valider') + 'Application installée</button>' :
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="installer">' + icone('telecharger') + 'Installer l\'application</button>') + '</section>';
    h += '<section class="bloc"><h3>MediPlanner</h3><p class="discret" style="margin-top:0">Version ' + APP_VERSION +
      '. Les mises à jour sont signalées par un bandeau en haut de l\'écran ; vos données restent sur le téléphone.</p>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="verifierMaj">Recherche MàJ</button>' +
      '<button class="bouton" type="button" data-a="ouvrirLancement">Écran d\'accueil</button></div></section>';
    // Avancé : connexion à la base, synchronisation, démonstration, effacement
    h += '<details class="bloc avance"' + (!c.url || S.ui.erreur ? ' open' : '') + '><summary><b>Avancé</b><span class="discret">Connexion à la base et données du téléphone</span></summary>' +
      '<h3>Saisie</h3><label class="interrupteur"><span>Saisie avancée<small class="discret bloc-texte">Comptes rendus des jours passés et à venir. Désactivée : seul le jour même se saisit ; la planification des jours à venir reste possible.</small></span>' +
        '<input type="checkbox" data-f="saisieAvancee"' + (c.modifPasse && c.saisieFutur ? ' checked' : '') + '></label>' +
      '<label class="interrupteur" style="margin-top:10px"><span>Compte rendu express<small class="discret bloc-texte">Saisie rapide des visites de routine sur un seul écran (statut, types, produits et prochain RDV). Le formulaire complet reste accessible d\'un clic.</small></span>' +
        '<input type="checkbox" data-f="crExpress"' + (c.crExpress ? ' checked' : '') + '></label>' +
      '<h3>Connexion au Google Sheet</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      (S.data && S.data.praticiens && !S.data.serveurRecent && connecte() ? '<p class="discret" style="color:var(--rouge)">Ce téléphone est relié à une ancienne version du serveur : touchez « Synchroniser maintenant » pour basculer automatiquement sur le serveur à jour.</p>' : '') +
      (connecte() ? '<p class="discret" style="margin:4px 0 0">Serveur : …' + esc(String(S.config.url).replace(/\/exec.*$/, '').slice(-6)) + '</p>' : '') +
      '<h3>Données</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') +
      (S.fiches.length ? ' ' + S.fiches.length + ' fiche(s) praticien en attente' + (S.ui.serveurAncien ? ' : le serveur Apps Script doit être mis à jour pour les recevoir.' : '.') : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' +
        '<button class="bouton bouton-large" type="button" data-a="rechargerBase" style="margin-bottom:10px">Recharger toute la base</button>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<h3>Sauvegarde</h3><p class="discret" style="margin-top:0">' +
        (S.data && S.data.sauvegarde ? 'Base : dernière copie le ' + new Date(S.data.sauvegarde).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (7 copies dans Drive).' : 'Base : sauvegarde quotidienne à installer dans le Google Sheet (menu MediPlanner › Sauvegardes).') +
        ' Téléphone : ' + Object.keys(LS.get('secours', {})).length + ' copie(s) sur 7 jours.</p>' +
      '<div class="rangee" style="margin-bottom:10px"><button class="bouton" type="button" data-a="exporterSecours">' + icone('telecharger') + 'Exporter</button>' +
        '<label class="bouton" style="position:relative;overflow:hidden">' + icone('relancer') + 'Importer<input type="file" accept="application/json,.json" data-f="importSecours" style="position:absolute;inset:0;opacity:0"></label></div>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button></details>';
    return h;
  };
