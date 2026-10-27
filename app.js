/* =============================================================================
   app.js : interface de MediPlanner
   - Données en cache sur le téléphone : tout fonctionne hors ligne
   - Visites, fiches praticiens et tournées envoyées au Google Sheet dès que possible
   - Écran de lancement, statistiques, filtres avancés, fiche praticien en 4 étapes,
     actions rapides (appel, SMS, Waze, Maps), thème clair / sombre
   - Mises à jour : bandeau « Mise à jour disponible » piloté par le service worker
   ============================================================================= */
(function () {
  'use strict';

  var APP_VERSION = '3.25.12';
  // Nouveautés par version : l'écran d'accueil affiche, une seule fois, celles des versions
  // publiées depuis la dernière ouverture du téléphone
  var JOURNAL = [
    ['3.25.11', ['Nouveau praticien ou pharmacie : « Récupérer la position » juste après les horaires du matin et du soir']],
    ['3.25.10', ['Pharmacies à proximité : les pharmacies sans position GPS de votre quartier sont aussi proposées (distance « ≈ »), et si rien n\'est dans le rayon, les plus proches au-delà s\'affichent',
      'Compte rendu de pharmacie enregistré : un produit par carte (état, quantité, anomalie), les uns après les autres']],
    ['3.25.9', ['Distances mesurées à vol d\'oiseau depuis la position réelle du téléphone (mesure la plus précise sur quelques secondes, rafraîchie chaque minute)',
      'Lieu sans position GPS : distance « ≈ » au centre du quartier, avec « Je suis devant : enregistrer sa position »',
      'Fiche : « Je suis sur place » prend une mesure fraîche et précise, qui remplace la position de la base à l\'enregistrement',
      'Journée : une visite enregistrée affiche l\'heure de son enregistrement, et non plus l\'heure planifiée',
      'Autour de moi : rayons 0,5, 2, 5 et 10 km']],
    ['3.25.8', ['Autour de moi, + Médecin, + Pharmacie, Selon mes filtres : résultats du plus proche au plus loin de votre position ; ceux déjà dans votre tournée sont omis',
      'Ajout du jour : les visites restantes s\'enchaînent depuis votre position']],
    ['3.25.7', ['Autour de moi, + Médecin, + Pharmacie : votre position est recalculée à chaque ouverture ou rafraîchissement, avant d\'afficher les résultats']],
    ['3.25.5', ['Nouveau praticien : l\'établissement se saisit en quelques lettres, avec les établissements déjà connus (quartier et position repris), pour éviter les doublons']],
    ['3.25.4', ['Messages WhatsApp (programme et compte rendu) mieux présentés : titres en gras, puces, sections aérées, heures et établissements numérotés']],
    ['3.25.3', ['Fenêtre « Ajouter » : champ de recherche retiré, la recherche se fait dans la liste « Selon mes filtres »']],
    ['3.25.2', ['Ajouter selon mes filtres (communes du jour) : champ de recherche en tête pour chercher parmi les praticiens déjà filtrés']],
    ['3.25.1', ['Autour de moi : champ de recherche libre en tête (nom, spécialité, établissement, commune), résultats dès les premières lettres, selon vos filtres, du plus proche au plus loin',
      'Même champ de recherche, avec la loupe, dans toutes les fenêtres d\'ajout']],
    ['3.25.0', ['Heures proposées entre 7 h 30 et 19 h ; une visite faite tard ne décale plus les suivantes',
               'Filtres : Cardiologue, Diabétologue, Endocrinologue et Généraliste cochés par défaut, modifiables',
               'Réglages › Avancé : un seul interrupteur « Saisie avancée » (jours passés et à venir) ; sans lui, une visite à venir s\'affiche sans compte rendu',
               'Planifier : demain sélectionné par défaut et centré ; jours passés grisés ; « Communes visitées » replié',
               'Ajouter : recherche libre dès les premières lettres (nom, spécialité, établissement, commune)',
               '« Ajouter manuellement » et « Recalculer automatiquement » ; les médecins épinglés restent au recalcul',
               'Tournée : « Accepter » puis « Envoyer par WhatsApp », ou « Ne pas accepter » (continuer à modifier, quitter sans valider)',
               'Journée : « Finaliser le compte rendu » centré ; en fin de journée, parcours dans l\'ordre des heures de validation',
               'Accueil modernisé, ouverture après 2 secondes ou d\'un toucher']],
    ['3.24.23', ['Journée : une visite renseignée passe en bas, dans « Effectuées » (toujours dans l\'ordre des heures) ; les visites à faire les plus proches restent en haut', 'Planifier : impossible de planifier un jour passé ; une semaine entamée ne planifie que les jours à venir', 'Planifier n\'affiche plus les jours passés ; ils restent mémorisés et se retrouvent dans « Reprendre un ancien programme »']],
    ['3.24.22', ['Pharmacies : nouvelles officines, y compris hors Abidjan (zone « Intérieur »)']],
    ['3.24.21', ['Fenêtres (fiche produit, choix, questions…) : on ferme avec la flèche retour en haut à gauche, comme dans Compte Rendu ; plus de croix', 'Carte de visite : « Quitter » avec la flèche retour']],
    ['3.24.20', ['Visite proche (GPS) : proposée à moins de 500 m (au lieu de 300 m), si le praticien est encore présent au moins 10 minutes (au lieu de 20)']],
    ['3.24.19', ['Fiche produit : la bande des produits tourne en boucle (après le dernier, le premier revient, dans les deux sens)']],
    ['3.24.18', ['Compte Rendu de visite : « Choisir » au lieu de « Choisir… (plusieurs possibles) »']],
    ['3.24.17', ['Réglages : libellé « WhatsApp Superviseur »']],
    ['3.24.16', ['Compte Rendu de la journée : bouton « Envoyer au superviseur » par WhatsApp (numéro renseigné dans Réglages)']],
    ['3.24.15', ['Produits : dans la fiche, plus de bouton Fermer (la croix en haut suffit) ; en bas, tous les produits à faire glisser, le produit affiché au centre']],
    ['3.24.14', ['Bilan : s\'ouvre toujours sur le Tableau de bord', 'Planifier : bouton « Envoyer par WhatsApp » avec son icône, centré', 'L\'écran ne bouge plus à chaque synchronisation ou rafraîchissement : les animations ne se jouent qu\'à l\'ouverture d\'un écran, et la position de lecture est gardée']],
    ['3.24.13', ['Réglages : le bouton « Installer l\'application » est toujours visible ; s\'il est déjà installé, il affiche « Application installée »']],
    ['3.24.12', ['Journée : sous la jauge, « X/Y réalisées · Z % renseignées » (comptes rendus saisis, visite faite ou non)']],
    ['3.24.11', ['Journée : sous la jauge, « X/Y réalisées · Z % »']],
    ['3.24.10', ['Planifier : « Reprendre un ancien programme » centré sous « Planifier ma tournée »']],
    ['3.24.9', ['Planifier : tous les jours planifiés, même en partie, restent affichés ; un jour n\'est plus écarté ni effacé de la base parce qu\'il manquait sur le téléphone', 'Les jours écartés par erreur reviennent automatiquement']],
    ['3.24.8', ['« Compte Rendu » avec la majuscule (titres, boutons, messages)']],
    ['3.24.7', ['Journée : X visites · X faites · X sans CR · X à planifier (visites par jour voulues moins celles déjà prévues) ; « sans CR » ouvre le compte rendu, « à planifier » ouvre Planifier pour ce jour']],
    ['3.24.6', ['Journée : toucher « X sans compte rendu » ouvre la page Compte rendu du jour']],
    ['3.24.5', ['Le mot pharmacie abrégé en « Phcie » à l\'écran (cartes, listes, boutons) pour gagner de la place ; rien ne change dans la base']],
    ['3.24.4', ['Recherche : « Réinitialiser les filtres et recommencer », centré']],
    ['3.24.3', ['Journée : à côté du titre, Avant-hier, Hier, Demain ou Après-demain, chacun dans sa couleur, comme Aujourd\'hui']],
    ['3.24.2', ['Journée : lieu, quartier, commune et GPS des visites suivent la base (officine ou cabinet déplacé, coordonnées corrigées) dès la synchronisation']],
    ['3.24.1', ['Journée : pourcentage du planning du jour réalisé, avec la barre de progression (visites faites / visites prévues)']],
    ['3.24.0', ['Animations plus vivantes : cartes en cascade, prochaine visite qui pulse, barres et jauges qui se remplissent, chiffres qui défilent, onde au toucher, rebond de l\'onglet, notifications glissantes']],
    ['3.23.4', ['Journée, Planifier, Recherche, Autour de moi : sous-titres sans redite (pas de « Pharmacien » ni du nom de la pharmacie répété ; la spécialité reste pour les médecins)']],
    ['3.23.3', ['Planifier : plus d\'alerte « médecins prévus par un collègue » ; chaque ligne concernée affiche directement « Prévu par … »']],
    ['3.23.2', ['Cartes de la journée : distance entre vous et chaque visite à faire (symbole de position), pour choisir qui voir en priorité',
               'L\'alerte « médecins prévus par un collègue » ne s\'affiche plus que dans Planifier',
               'Trajets en symboles : distance, minutes à pied et en voiture, entre les visites et jusqu\'à la visite suivante (depuis votre position quand le GPS est actif)']],
    ['3.23.1', ['Médecin et pharmacie signalés par leur symbole (caducée du médecin en bleu, coupe d\'Hygie de la pharmacie en violet) au lieu du mot',
               'Pharmacie proche : « X est à 150 mètres, ouverte jusqu\'à 12:30 (Jamais visité). Y aller ? »']],
    ['3.23.0', ['Boutons de confirmation raccourcis : « Enregistrer », « Confirmer », « Ajouter »… au lieu de « Oui, … »',
               'Journée : une pharmacie ouverte à moins de 500 m, hors de votre journée et pas vue récemment, est signalée avec sa distance ; « Oui » l\'ajoute maintenant',
               'Journée : si le GPS vous situe à moins de 300 m d\'une visite prévue plus tard (praticien présent à cette heure), « Le voir maintenant ? » la ramène juste après la visite en cours et recalcule les heures suivantes']],
    ['3.22.3', ['Produits : la première aire thérapeutique est dépliée par défaut, les autres au toucher']],
    ['3.22.2', ['Journée : + Médecin et + Pharmacie proposent « Par ma position » ou « Selon mes filtres » (communes du jour, spécialités)',
               'Autour de moi : bouton « + Aujourd\'hui » plus court ; boutons secondaires centrés et moins larges',
               'Planifier : tous les jours qui ont au moins une donnée (brouillon compris) apparaissent d\'office dans la frise']],
    ['3.22.1', ['Journée, en bas : + Médecin, + Pharmacie et Autour de moi (par ma position ou dans les communes du jour) pour remplacer au pied levé un praticien qui n\'est plus disponible']],
    ['3.22.0', ['Nouveau praticien sans position prise sur place : coordonnées GPS cherchées automatiquement sur Google Maps et inscrites dans la base',
               'Mon profil : un nom absent de la liste est ajouté aux délégués dans la base',
               'Sauvegarde : copie complète de la base chaque nuit dans Drive (7 copies) ; copie de secours du téléphone sur 7 jours, à exporter ou reprendre dans Réglages › Avancé']],
    ['3.21.0', ['Bilan et Équipe : un seul filtre en haut, « Qui » (moi, toute l\'équipe ou plusieurs délégués choisis) et « Quand » (jour, semaine, mois ou période, avec ‹ ›)',
               'Bilan : Tableau de bord et Historique suivent le même filtre ; l\'historique se limite à la période choisie']],
    ['3.20.0', ['Planifier devient un agenda : tous les jours planifiés (7 jours passés et tout l\'à venir) dans une frise chronologique, chaque jour confirmé ou en brouillon',
               'Planifier : le parcours s\'ouvre sur une page à part et disparaît dès que la tournée est proposée ; une nouvelle planification ne touche que ses propres jours',
               'Après « Recalculer ce jour » : « Accepter » ou « Recalculer encore » ; « Envoyer par WhatsApp » apparaît une fois le jour confirmé',
               '« Ajouter à la tournée » au-dessus de « Recalculer ce jour » : autour de ma position ou dans les communes du jour']],
    ['3.19.0', ['Journée s\'ouvre toujours sur aujourd\'hui ; bande des jours défilante (glisser), jour choisi au centre et en couleur',
               'Questions en trois boutons partout : Oui, Non, Sortir',
               'RDV en une ligne courte (« RDV du 05-Nov reporté au 07-Nov pour absence ») ; bandeau « Tournée confirmée » affiché quelques secondes',
               'Recherche : critères sur une page à part ; les résultats montrent le nombre et les critères appliqués, avec « Tout effacer »',
               'Produits : une section repliable par aire thérapeutique',
               'Réglages : libellés raccourcis, « Mon quartier », bouton « Installer l\'application »',
               'Animations discrètes (changement d\'écran, question suivante, carte ouverte, compte rendu enregistré)']],
    ['3.18.0', ['Médecins en bleu, pharmacies en violet : pastille « Médecin » / « Pharmacie » devant le nom et liseré de couleur sur les cartes (Journée, Planifier, Recherche, Autour de moi, Historique)']],
    ['3.17.2', ['Journée › « Planifier le … » : Planifier s\'ouvre directement à l\'étape 2 (la période est déjà réglée sur ce jour)']],
    ['3.17.1', ['Journée : le bouton « Planifier le … » apparaît aussi quand aucune tournée n\'existe ; un week-end ou un jour férié propose le prochain jour ouvré']],
    ['3.17.0', ['Journée : un jour sans visite propose « Planifier le … » (Planifier s\'ouvre réglé sur ce jour)',
               'Planifier : bandeau « Déjà planifié » ; les visites déjà prévues ou renseignées restent en place, à leur heure, et seuls les créneaux libres sont complétés',
               'Une nouvelle tournée ne remplace dans la base que sa propre période',
               'Planifier reprend toujours le parcours à l\'étape 1, même après une interruption']],
    ['3.16.0', ['Réglages › Avancé › Saisie : option « Saisir les jours à venir » (désactivée par défaut, les jours futurs restent en aperçu)']],
    ['3.15.0', ['Onglet Produits : 15 produits ajoutés (Zyltan, Lesstrol AM et EZ, Rozukaa F, A et Gold, Telmikaa AM, H, AMH et CT, Antiplatt Plus, Myonit SR, Orlitroy, Troynuron, Lesskaa)', 'Nouveaux filtres « Angor » et « Métabolisme »']],
    ['3.14.0', ['L\'onglet « Aujourd\'hui » devient « Journée » ; l\'étiquette « Aujourd\'hui » s\'affiche à côté du titre le jour même',
               'Cercle de la visite : vide et rouge pour une visite non faite pas encore enregistrée (vert vide pour une visite faite), plein une fois enregistré',
               'Heures toujours affichées à gauche de la ligne, y compris pour les visites des jours passés', 'Barre « Enregistrer les comptes rendus » : confirmation Oui / Non']],
    ['3.13.4', ['Aujourd\'hui : phrase de présentation rétablie, marge de gauche réduite',
               'Compte rendu : accès en haut de l\'écran, il s\'ouvre dans sa propre page (bouton retour vers Aujourd\'hui)',
               'Carte de visite : le cercle vert plein suffit à dire « enregistré » ; cercle vide tant que le compte rendu n\'est pas enregistré',
               'Comptes rendus : une valeur par ligne au lieu d\'une liste séparée par des virgules']],
    ['3.13.3', ['Réglages › Avancé : option « Modifier les jours passés » ; désactivée, les jours passés sont en lecture seule']],
    ['3.13.2', ['Jours passés : plus de lecture seule ; chaque visite se complète ou se modifie (compte rendu pas à pas), et le compte rendu de la journée se remplit et se valide comme pour aujourd\'hui']],
    ['3.13.1', ['Jour passé hors de la tournée en cours : les visites prévues sans compte rendu s\'ouvrent avec le compte rendu pas à pas (visite faite, produits présentés…), comme dans la tournée']],
    ['3.13.0', ['Aujourd\'hui, écran de terrain : la date sous le titre, une seule bande de la semaine, la synthèse et la progression du compte rendu du jour',
               '« Maintenant » : la visite suivante avec ses actions, les comptes rendus à saisir, puis la finalisation de la journée',
               'Chaque visite tient sur une ligne avec son état (faite, non faite, à saisir, à venir) ; une visite non faite se remplace directement par un praticien disponible, son compte rendu est gardé',
               'Nouveau : compte rendu de la journée, rempli à partir des visites (visites, produits, échantillons, commandes, ruptures, RDV, trajet), complété par les faits marquants, la concurrence, les besoins et les kilomètres, enregistré dans la feuille « Rapports du jour » et envoyé sur WhatsApp au responsable']],
    ['3.12.0', ['Aujourd\'hui : le titre indique le jour affiché (« Aujourd\'hui » ou la date), avec « Revenir à aujourd\'hui »',
               'Aujourd\'hui : flèches ‹ › et calendrier pour aller sur n\'importe quel jour ; un jour passé montre les visites faites et leurs comptes rendus, un jour à venir la tournée publiée, avec « Reprendre ce programme »']],
    ['3.11.1', ['Produits : disposition compacte, une ligne par gamme avec ses produits en pastilles et un filtre par aire ; la fiche s\'ouvre dans une fenêtre, l\'essentiel visible (indications, contre-indications, arguments), le reste à déplier']],
    ['3.11.0', ['Produits : les produits s\'affichent en grille de 2 ou 3 colonnes par gamme ; la fiche s\'ouvre en pleine largeur, début du texte en haut de l\'écran',
               'Accueil : « Lancer l\'application » en premier (vers Aujourd\'hui), « Voir mon bilan » ensuite ; plus de décompte après une mise à jour',
               'Recherche : le bouton Recherche reprend toujours à la question 1',
               'Visite non faite, remplaçant : ouvre + Médecin ou + Pharmacie selon le praticien',
               'Enregistrer le compte rendu ou la modification : Oui / Non',
               'Compte rendu enregistré : présenté en tuiles avec un bouton Modifier ; Retirer de la tournée (Oui / Non) et Quitter côte à côte']],
    ['3.10.0', ['Nouvel onglet Produits : aide-mémoire de visite par gamme (Zyltan, Telmikaa, Tensicard, Rozukaa, Lesstrol, Eurythmic, Antiplatt) avec indications, contre-indications, posologie, précautions, effets indésirables et arguments clés', 'Les fiches sont dans une nouvelle feuille « Fiches produits » du Google Sheet, modifiable', 'Aujourd\'hui, en bas : « Pour étoffer la liste de ce jour » avec + Médecin, + Pharmacie et Planifier', 'Aujourd\'hui : la carte touchée se centre à l\'écran pour voir tout son contenu']],
    ['3.9.4', ['RDV et prioritaires : un RDV pris un jour sans présence connue est placé à la prochaine présence, et la date retenue est indiquée']],
    ['3.9.3', ['Planifier et Recherche : boutons Précédent (sauf à la 1re étape), Suivant (Terminer à la dernière) et Passer quand la question s\'y prête ; « Quitter » en haut pendant le parcours', 'RDV et prioritaires : les RDV déjà pris dans les comptes rendus apparaissent (date du RDV, date de prise), avec les prioritaires ajoutés']],
    ['3.9.2', ['Planifier : chaque tuile du récapitulatif ouvre sa propre option (Spécialités ouvre Spécialités, etc.) ; la période aussi', 'Recherche : même récapitulatif en tuiles, chaque tuile ouvre son critère']],
    ['3.9.1', ['Modifier un compte rendu, une fiche ou vos réglages sans rien changer : l\'application l\'indique (« Aucune modification ») au lieu de « Enregistré » ; une vraie modification affiche « Compte rendu modifié »']],
    ['3.9.0', ['Planifier : le résumé de la tournée est rangé en tuiles (Communes, Praticiens, Spécialités, Potentiel, Rythme, RDV) sous la période ; touchez une tuile pour la modifier']],
    ['3.8.9', ['Compte rendu : réaction du médecin (Intéressé, Indécis…), état du stock et anomalie en boutons, comme le reste de l\'application', 'Plus aucune liste déroulante : nom du délégué, point de départ, quartier (Autour de moi, fiche praticien) et spécialité s\'ouvrent dans une liste avec recherche']],
    ['3.8.8', ['Recherche : planifier depuis le calendrier d\'un praticien propose la prochaine présence et les suivantes (+7, +14, +21, +28 jours), puis Oui ou Non']],
    ['3.8.7', ['Compte rendu : les réponses utilisent les mêmes éléments que Planifier : Oui / Non en segment, listes longues (types de visite, produits, motif) dans un sélecteur qui ouvre la liste, quantités et réactions en champs étiquetés', 'Ajouter un praticien : même parcours (étapes faites repliées en lignes modifiables, étape en cours dans son cadre)', 'Toutes les étapes indiquent « étape n/N »']],
    ['3.8.6', ['Planifier : « Confirmer la tournée » demande Oui ou Non ; Non vous ramène au brouillon', 'Recherche : « + Nouveau » devient « + Ajouter »', 'Aujourd\'hui : le compte rendu prend le même format que Planifier (titre, étape en cours, réponses repliées en lignes courtes, Passer et Continuer côte à côte, Oui / Non en puces)']],
    ['3.8.5', ['Après une mise à jour, l\'application s\'ouvre sur « Aujourd\'hui »', 'Recherche : la fiche d\'un praticien s\'ouvre là où il est dans la liste, sans remonter en tête']],
    ['3.8.4', ['Équipe : sélectionnez un ou plusieurs délégués pour les isoler ; « Toute l\'équipe » les affiche tous', 'Plusieurs délégués : un bloc repliable par délégué, avec ses visites et celles faites', 'Planifier et Recherche : bouton « Fermer » à droite du titre ; le bloc s\'appelle simplement « Planifier »']],
    ['3.8.3', ['Recherche : comme Planifier, un résumé des critères et un bouton « Recherche » qui déploie la recherche ; « Fermer la recherche » la replie']],
    ['3.8.2', ['Planifier : bouton « Planifier » (ex-Réglages) ; la planification de la tournée se fait une option à la fois : Période, Communes ciblées, Praticiens à visiter, Spécialités, Potentiel, Rythme de visite, RDV et prioritaires', 'Chaque réponse se replie en une ligne modifiable ; « Proposer ma tournée » apparaît une fois les questions répondues', '« Reprendre un ancien programme » reste accessible à tout moment']],
    ['3.8.1', ['Recherche et Autour de moi : les critères sont posés une question à la fois, comme le compte rendu (Qui ? puis Quelle spécialité ? puis Où ? puis Quelle valeur ? puis Quel suivi ? puis Dans quel ordre ?)', 'Chaque réponse se replie en une ligne modifiable ; à la fin, une seule ligne « Critères » résume tout', 'Les raccourcis restent à la première question et mènent directement aux résultats']],
    ['3.8.0', ['Recherche et Autour de moi : filtres rangés dans l\'ordre des questions : Qui ? Quelle spécialité ? Où ? Quelle valeur ? Quel suivi ? Dans quel ordre ?', 'Une puce par question, qui affiche sa valeur et ouvre uniquement cette question ; « Tous » ouvre l\'ensemble, numéroté de 1 à 6, tri compris', 'Raccourcis d\'un geste conservés sur leur propre ligne ; « Tout effacer » à côté du tri', 'Pharmacies : la puce Spécialité disparaît, vos spécialités restent mémorisées']],
    ['3.7.2', ['Aujourd\'hui : boutons « + Médecin », « + Pharmacie » et « Autour de moi » sur une même ligne, sous la présentation', '« + Médecin » : les médecins présents près de vous, selon les spécialités de votre tournée', 'Le jour affiché (ex. mercredi) reste affiché après un rafraîchissement, jusqu\'à minuit']],
    ['3.7.1', ['Remplacer : la liste des praticiens disponibles ce jour-là (pré-filtrés selon vos critères) s\'affiche, vous choisissez, puis vous confirmez Oui ou Non', 'Toute modification de la tournée (retirer, ajouter, remplacer) demande une confirmation', 'Plus de remplacement automatique quand un collègue a prévu le même médecin : la carte vous pose la question']],
    ['3.7.0', ['Médecin déjà prévu par un collègue : « Le remplacer ? Oui / Non » au lieu de « Retirer »', 'Aujourd\'hui : bouton « Pharmacie » pour ajouter une pharmacie ouverte près de votre position']],
    ['3.6.3', ['Dates au format 26-Oct-2026', 'RDV placé dans la tournée : l\'étiquette indique quand il a été pris (et s\'il a été décalé faute de présence ce jour-là)']],
    ['3.6.2', ['Tous les calendriers affichent la date en français, au format JJ/Mmm/AAAA (ex. 16/Nov/2026)']],
    ['3.6.1', ['Reprendre un ancien programme : choisissez aussi le jour ou la semaine sur lesquels le copier, puis conservez-le ou revenez à l\'ancienne planification']],
    ['3.6.0', ['Compte rendu pas à pas : une seule question à la fois, la suivante selon la réponse ; les réponses restent en lignes courtes, touchez-les pour modifier', 'Produits, activités, statuts et délégués suivent la base en temps réel (mise à jour chaque minute)', 'Délégués : « yavosylvie10@gmail.com » fusionné avec « Sylvie »']],
    ['3.5.1', ['Compte rendu : « Prochaine étape le » (+7 j, +14 j, +30 j, calendrier) de nouveau toujours visible avant l\'enregistrement']],
    ['3.5.0', ['Comptes rendus guidés par un arbre de décision : « La visite a-t-elle été faite ? » puis, pour les médecins, types, produits présentés et réactions, échantillons, bilan ; pour les pharmacies, interlocuteur, activités, stock par produit, commande, compléments', 'Visite non faite : motif, précision, remplaçant à proximité ; produits, stocks et discussion masqués', 'Suite : rappel ou RDV confirmé avec date ; seul un RDV confirmé ajoute la visite à la tournée, les rappels s\'affichent dans « Aujourd\'hui »', 'Base mise à jour : statuts, activités médecins et pharmacies, produits (avec Juvamine), délégués ; « Conventionné » devient « Engagé »']],
    ['3.4.0', ['Équipe : choisissez un jour ou une semaine (flèches ou date) et voyez ce qui a été planifié et fait par vous et vos collègues, avec « Toute l\'équipe »']],
    ['3.3.2', ['Nom de l\'application : MediPlanner, sans mention supplémentaire']],
    ['3.3.1', ['Planifier : « Reprendre un ancien programme » toujours visible, juste au-dessus de « Proposer ma tournée »']],
    ['3.3.0', ['Équipe : votre propre tournée apparaît aussi, en tête, avec celles de vos collègues', 'Planifier : « Reprendre un ancien programme » copie une semaine ou une journée passée en brouillon, point de départ pour vos modifications']],
    ['3.2.1', ['Équipe : la carte de la journée du collègue est affichée tout en bas', 'L\'onglet « Praticiens » devient « Recherche », avec une phrase qui résume les critères retenus']],
    ['3.2.0', ['Itinéraire : les praticiens d\'un même établissement s\'enchaînent, puis les établissements de proche en proche, sans dépasser les horaires de présence']],
    ['3.1.0', ['Compte rendu propre aux pharmacies : visitée oui ou non, activités en officine, produits disponibles (avec Juvamine), état des stocks (en stock, rupture, périmé…)']],
    ['3.0.4', ['Planifier : « Envoyer sur WhatsApp » placé en bas, juste au-dessus de la carte']],
    ['3.0.3', ['L\'onglet « Ma semaine » s\'appelle désormais « Planifier »']],
    ['3.0.2', ['Compte rendu : les champs se déploient dès que le résultat de la visite est choisi']],
    ['3.0.1', ['Compte rendu complet de nouveau visible d\'emblée : vu ou non, type de visite, produits présentés, ce qui est ressorti de la discussion, prochaine étape']],
    ['3.0.0', ['Nouvelle organisation en 5 onglets qui suivent votre journée : Aujourd\'hui, Ma semaine, Praticiens, Équipe, Bilan',
               'Aujourd\'hui : vos visites dans l\'ordre, contact en premier, compte rendu guidé (résultat d\'abord, puis le détail)',
               'Ma semaine : réglages, proposition, médecins gardés ou retirés, confirmation et envoi WhatsApp, communes visitées',
               'Autour de moi s\'ouvre depuis Aujourd\'hui ou depuis une visite non faite (« Trouver un remplaçant »)',
               'Vocabulaire simplifié : tournée confirmée, brouillon, RDV, prioritaire, prochain RDV, communes visitées, taux de réalisation',
               'Réglages allégés : connexion et effacement des données rangés dans « Avancé »']],
    ['2.2.7', ['L\'application rouvre sur l\'onglet où vous étiez, après un rafraîchissement ou une mise à jour']],
    ['2.2.6', ['« Vu il y a … j » mis à jour dès qu\'un compte rendu est validé', 'Prochaine étape traitée comme un RDV : le praticien est placé d\'office ce jour-là dans la tournée']],
    ['2.2.5', ['Tournée : bouton « Valider ce compte rendu » dans chaque fiche de visite, et « Modifier le compte rendu » une fois validé']],
    ['2.2.4', ['Filtres : les spécialités ne concernent que les médecins ; elles sont ignorées (mais conservées) en choisissant Pharmacies']],
    ['2.2.3', ['Autour : pharmacies affichées du lundi au vendredi, sur toute leur plage horaire']],
    ['2.2.1', ['Titre « Tournée » affiché en haut de l\'onglet, comme les autres onglets']],
    ['2.2.0', ['Message WhatsApp : une puce devant chaque médecin',
               'Chaque onglet présente son rôle en une phrase',
               'Autour : mêmes filtres que Contacts, rayon 2 km et « Maintenant » par défaut, filtre Tout / Médecins / Pharmacies',
               'Programme validé toujours modifiable (il reste validé pour l\'équipe) ; compte rendu enregistré corrigeable',
               'Tournée : couverture « Jour » et « Couvertes » par défaut ; vos filtres restent mémorisés',
               'Type de visite : Routine, Réunion, Staff, Déjeuner, Garde ; produits de la gamme en un toucher',
               'Synchronisation plus fiable : nouvelles tentatives automatiques, aucune saisie perdue',
               'Formulaires et listes déroulantes modernisés',
               'Un praticien d\'un programme validé par un collègue n\'est plus proposé']],
    ['2.1.1', ['Fond de carte OpenStreetMap épuré (clair et sombre)']],
    ['2.1.0', ['Pharmacies réelles d\'Abidjan (OpenStreetMap) dans leur propre feuille, ouvertes matin et soir',
               'Jours fériés signalés, d\'après le calendrier officiel de la Côte d\'Ivoire',
               'Type de visite (routine, présentation produit, EPU…) dans le compte rendu et les statistiques',
               'WhatsApp à la place de Waze dans les fiches', 'Cartes modernes pour la couverture et les tournées de l\'équipe',
               'Après validation, l\'envoi du programme est proposé ; établissements en gras dans le message']],
    ['2.0.7', ['Couverture repliée par défaut sous la tournée (un toucher pour la carte et les communes)']],
    ['2.0.6', ['Compte rendu : produits présentés et date de prochaine étape (le praticien remonte en priorité à cette date)',
               'Temps de trajet plus réalistes : heures de pointe et traversée de la lagune',
               'Jours fériés et absences des praticiens respectés dans les tournées',
               'Lieux où le praticien est souvent absent signalés et proposés en dernier',
               'Nom du délégué choisi dans une liste', 'Historique regroupé dans l\'onglet Stats', 'Synchronisation plus légère']],
    ['2.0.5', ['Filtres sélectionnés de nouveau en couleur pleine, bien visibles', 'Base de test complétée : téléphones fictifs, derniers statuts et commentaires, positions GPS des établissements']],
    ['2.0.4', ['Filtres modernisés : puces cochées, recherche dans les listes, groupes repliables, filtres rapides en un toucher',
               'Thème clair par défaut ; tournée sans pharmacies par défaut', 'Sur tablette, les fenêtres s\'ouvrent au centre de l\'écran']],
    ['2.0.3', ['Les nouveautés ne s\'affichent qu\'une fois par mise à jour', 'L\'application se lance seule quelques secondes après l\'écran d\'accueil']],
    ['2.0.2', ['Message WhatsApp simplifié : titre, date, votre nom, puis chaque établissement avec ses médecins']],
    ['2.0.1', ['Potentiel de prescription de nouveau affiché en étoiles (★ à ★★★)']],
    ['2.0.0', ['Nouveau nom : MediPlanner, avec un écran d\'accueil et les chiffres clés',
               'Onglet Stats : couverture, objectifs, activité par commune et par spécialité',
               'Filtres avancés cumulables dans Contacts (spécialités, communes, potentiel ★ à ★★★, dernière visite)',
               'Tournée : spécialités ciblées, pharmacies oui/non, durée estimée et itinéraire du jour',
               'Fiche praticien en 4 étapes depuis le téléphone, même hors ligne',
               'Appeler, SMS, Waze ou Google Maps depuis chaque fiche',
               'Mode sombre (Réglages) et mises à jour signalées par un bandeau']]
  ];
  function compVersion(a, b) {
    var x = String(a || '0').split('.'), y = String(b || '0').split('.');
    for (var i = 0; i < 3; i++) { var d = (+x[i] || 0) - (+y[i] || 0); if (d) return d; }
    return 0;
  }
  var DELAI_LANCEMENT = 2, DELAI_LANCEMENT_NOUVEAUTES = 10;   // secondes avant le lancement automatique

  // ------------------------------------------------------------------ Stockage local
  var PREFIXE = 'tournees.';
  var LS = {
    get: function (k, d) {
      try { var v = localStorage.getItem(PREFIXE + k); return v === null ? d : JSON.parse(v); }
      catch (e) { return d; }
    },
    set: function (k, v) {
      // les visites d'un jour hors tournée (compte rendu saisi après coup) sont gardées avec la tournée
      if (k === 'plan' && typeof S !== 'undefined' && S && S.horsPlan) { try { localStorage.setItem(PREFIXE + 'horsPlan', JSON.stringify(S.horsPlan)); } catch (e) {} }
      try { localStorage.setItem(PREFIXE + k, JSON.stringify(v)); }
      catch (e) { toast('Mémoire du téléphone pleine : certaines données n\'ont pas été enregistrées.'); }
    },
    vider: function () {
      try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(PREFIXE) === 0) localStorage.removeItem(k); }); } catch (e) {}
    }
  };

  function aujourdhui() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function minutesMaintenant() { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  function prochainJourOuvre(iso) { var i = jourSemaineIndex(iso); return i > 4 ? ajouterJours(iso, 7 - i) : iso; }
  function semaineParDefaut(iso) { var i = jourSemaineIndex(iso); return i >= 4 ? ajouterJours(iso, 7 - i) : iso; }

  // ------------------------------------------------------------------ État
  var donnees = LS.get('data', null);
  if (donnees && (!donnees.praticiens || !donnees.presences)) donnees = null;   // cache d'une ancienne version
  var plan = LS.get('plan', []);
  var ancienPlan = plan.length && !plan[0].cle;   // tournée d'une version précédente (ancienne base)
  if (ancienPlan) plan = [];

  var S = {
    config: LS.get('config', { url: '', token: '', demo: false, delegue: '', whatsapp: '', waWeb: false, depart: '' }),
    data: donnees,
    plan: plan,
    programme: LS.get('programme', { etat: 'proposition', valideLe: '' }),
    params: LS.get('params', null),
    imposes: LS.get('imposes', []),
    rejetes: LS.get('rejetes', {}),
    queue: LS.get('queue', []),
    fiches: LS.get('fiches', []),
    ui: {
      tab: (function () {
        // 3.0.0 : nouveaux onglets du parcours (anciens noms convertis)
        var t = LS.get('onglet', 'jour'), anciens = { tournee: 'jour', contacts: 'praticiens', stats: 'bilan', historique: 'bilan' };
        t = anciens[t] || t;
        return ['jour', 'semaine', 'autour', 'rapport', 'praticiens', 'produits', 'bilan', 'equipe', 'reglages'].indexOf(t) >= 0 ? t : 'jour';
      })(), jour: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.j : null; })(),
      jourVue: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.v || null : null; })(), ouvert: null, voirParams: false, feuille: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, eqSel: LS.get('eqSel', []), jourEquipe: null, histFiltre: LS.get('histFiltre', 'moi'), rechercheAutour: '',
      couvPortee: LS.get('couvPortee', 'jour'), couvFiltre: LS.get('couvFiltre', 'couvertes'), couvOuverte: false,
      statsVue: 'tableau', annulReprise: LS.get('annulReprise', null), eqPortee: LS.get('eqPortee', 'semaine'), eqDate: aujourdhui(),
      autour: LS.get('autour', { lat: null, lon: null, label: '', moment: 'maintenant', date: '', heure: '', rayon: 2, ref: null }),
      aPublier: LS.get('aPublier', false), portee: LS.get('portee', null), conflits: [],
      filtres: null, tri: LS.get('tri', 'priorite'), stats: null, lancement: false
    }
  };
  // 3.20.0 : agenda. Tous mes jours planifiés (7 jours passés et tout l'à venir) sont dans S.plan ;
  // l'état brouillon / confirmé est porté par chaque jour (S.jours), plus par une tournée unique.
  S.jours = LS.get('etatsJours', null);
  if (!S.jours) {
    S.jours = {};
    var p0 = S.programme || {};
    Array.from(new Set(S.plan.map(function (x) { return x.date; }))).forEach(function (d) {
      S.jours[d] = { etat: p0.etat === 'valide' ? 'valide' : 'proposition', valideLe: p0.valideLe || '', modifieLe: p0.modifieLe || '' };
    });
    LS.set('etatsJours', S.jours);
  }
  // 3.25.0 : spécialités cochées par défaut partout (modifiables dans chaque filtre)
  var SPECS_DEFAUT = ['Cardiologue', 'Diabétologue', 'Endocrinologue', 'Généraliste'];
  var FILTRES_VIDES = { specialites: SPECS_DEFAUT.slice(), communes: [], potentiels: [], visite: 'tous', conv: 'tous', type: 'tous', equipe: 'tous' };
  S.ui.filtres = Object.assign({}, FILTRES_VIDES, LS.get('filtres', {}));
  S.ui.pharmaciesProches = S.ui.tab === 'autour' ? LS.get('proches', false) : false;
  if (S.ui.pharmaciesProches === true) S.ui.pharmaciesProches = 'Pharmacie';
  S.ui.filtresAutour = Object.assign({}, FILTRES_VIDES, LS.get('filtresAutour', {}));
  // « Pharmacien » n'est plus une spécialité filtrable (2.2.4)
  [S.ui.filtres, S.ui.filtresAutour].forEach(function (f) { f.specialites = (f.specialites || []).filter(function (x) { return x !== 'Pharmacien'; }); });
  if (!LS.get('specsDefaut325', false)) {
    S.ui.filtres.specialites = SPECS_DEFAUT.slice(); S.ui.filtresAutour.specialites = SPECS_DEFAUT.slice();
    LS.set('filtres', S.ui.filtres); LS.set('filtresAutour', S.ui.filtresAutour);
  }
  // 2.2.0 : nouveaux réglages par défaut (une seule fois)
  if (!LS.get('defauts220', false)) {
    S.ui.autour.moment = 'maintenant'; S.ui.autour.rayon = 2; LS.set('autour', S.ui.autour);
    S.ui.couvPortee = 'jour'; S.ui.couvFiltre = 'couvertes'; LS.set('couvPortee', 'jour'); LS.set('couvFiltre', 'couvertes');
    LS.set('defauts220', true);
  }
  // Contacts et Autour ont chacun leur propre jeu de filtres, conservé jusqu'à modification
  function cleFiltres() { return S.ui.tab === 'autour' ? 'filtresAutour' : 'filtres'; }
  function filtresCour() { return S.ui[cleFiltres()]; }
  function rechercheCour() { return S.ui.tab === 'autour' ? S.ui.rechercheAutour : S.ui.recherche; }
  function majFiltres(f) { S.ui[cleFiltres()] = f; LS.set(cleFiltres(), f); S.ui.limite = 40; }
  S.ui.stats = Object.assign({ periode: 'semaine', debut: '', fin: '', portee: 'moi', objectif: 40, vueSpec: 'base' }, LS.get('stats', {}));
  // L'ancienne tournée publiée est retirée de la feuille Plannings pour ne pas bloquer les collègues
  if (ancienPlan) {
    var auj = aujourdhui();
    S.ui.portee = { debut: ajouterJours(auj, -7), fin: ajouterJours(auj, 28) }; LS.set('portee', S.ui.portee);
    S.ui.aPublier = true; LS.set('aPublier', true);
  }
  var defautParams = { mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), communes: [], parJour: false,
                       communesJour: {}, maxJour: 8, delai: 7, eviterCollegues: true,
                       specialites: SPECS_DEFAUT.slice(), typeCibles: 'medecins', potentiels: [] };
  S.params = Object.assign({}, defautParams, S.params || {});
  if (!Array.isArray(S.params.communes)) S.params.communes = [];
  if (!Array.isArray(S.params.specialites)) S.params.specialites = [];
  if (!LS.get('specsDefaut325', false)) { S.params.specialites = SPECS_DEFAUT.slice(); LS.set('params', S.params); LS.set('specsDefaut325', true); }
  // v2.0.4 : par défaut, tournée sans pharmacies (réglage appliqué une fois aux téléphones existants)
  if (!S.params.defauts204) { S.params.typeCibles = 'medecins'; S.params.defauts204 = true; LS.set('params', S.params); }
  if (!Array.isArray(S.params.potentiels)) S.params.potentiels = [];
  // 3.25.0 : la période proposée commence demain (J+1), y compris après rafraîchissement
  if (!S.params.dateRef || S.params.dateRef <= aujourdhui()) { S.params.dateRef = prochainJourOuvre(ajouterJours(aujourdhui(), 1)); LS.set('params', S.params); }
  S.config = Object.assign({ whatsapp: '', waWeb: false, depart: '', delegue: '' }, S.config);

  // 3.22.0 : copie de secours du téléphone, une par jour sur 7 jours (comptes rendus et fiches non envoyés, agenda,
  // comptes rendus de journée). Exportable en fichier depuis Réglages › Avancé, pour reprendre après un incident.
  // reprise : on ajoute ce qui manque (comptes rendus et fiches non envoyés, comptes rendus de journée) ;
  // l'agenda n'est repris que si le téléphone n'en a plus. Rien d'existant n'est écrasé.
  function importerSecours(fichier) {
    var lecteur = new FileReader();
    lecteur.onload = function () {
      var o; try { o = JSON.parse(lecteur.result); } catch (e) { toast('Fichier illisible.'); return; }
      var sec = o && o.secours, jours = sec ? Object.keys(sec).sort() : [];
      if (!jours.length) { toast('Ce fichier n\'est pas une sauvegarde MediPlanner.'); return; }
      var s = sec[jours[jours.length - 1]];
      confirmerPuis('Reprendre une sauvegarde', 'Reprendre la sauvegarde du <b>' + dateFr(jours[jours.length - 1]) + '</b>' + (o.delegue ? ' (' + esc(o.delegue) + ')' : '') +
        ' ? Les comptes rendus et fiches non envoyés qui manquent seront ajoutés ; rien d\'existant n\'est remplacé.', 'Reprendre', function () {
        var uids = ensemble(S.queue.map(function (v) { return v.uid; }).concat(((S.data && S.data.historique) || []).map(function (v) { return v.uid; })));
        var nq = (s.queue || []).filter(function (v) { return !uids[v.uid]; }); S.queue = S.queue.concat(nq);
        var fu = ensemble(S.fiches.map(function (f) { return f.uid; })), nf = (s.fiches || []).filter(function (f) { return !fu[f.uid]; }); S.fiches = S.fiches.concat(nf);
        Object.keys(s.rapports || {}).forEach(function (d) { if (!S.rapports[d]) S.rapports[d] = s.rapports[d]; }); LS.set('rapports', S.rapports);
        var np = 0;
        if (!S.plan.length && (s.plan || []).length) { S.plan = s.plan; S.jours = s.jours || {}; np = datesPlan().length; }
        sauver(); rendre(); if (connecte()) synchroniser(true);
        toast(nq.length + ' compte(s) rendu(s), ' + nf.length + ' fiche(s)' + (np ? ', ' + np + ' jour(s) d\'agenda' : '') + ' repris.', 5000);
      });
    };
    lecteur.readAsText(fichier);
  }
  function copieSecours() {
    var t = aujourdhui(), sec = LS.get('secours', {});
    sec[t] = { le: new Date().toISOString(), delegue: moi(), queue: S.queue, fiches: S.fiches, plan: S.plan, jours: S.jours,
               horsPlan: S.horsPlan || [], rapports: S.rapports || {}, imposes: S.imposes };
    Object.keys(sec).sort().reverse().slice(7).forEach(function (d) { delete sec[d]; });
    LS.set('secours', sec);
  }
  function sauver() {
    archiverPlan(); nettoyerAgenda(); try { copieSecours(); } catch (e) { /* stockage plein : la sauvegarde n'empêche pas l'enregistrement */ }
    LS.set('config', S.config); LS.set('data', S.data); LS.set('plan', S.plan); LS.set('etatsJours', S.jours);
    LS.set('params', S.params); LS.set('queue', S.queue); LS.set('imposes', S.imposes); LS.set('rejetes', S.rejetes);
    LS.set('fiches', S.fiches);
    archiverPlan();
  }
  // Archive locale des tournées (par date, 70 jours) : permet de reprendre un ancien programme, même hors ligne
  function archiverPlan() {
    if (!S.plan.length) return;
    var arch = LS.get('archives', {}), limite = ajouterJours(aujourdhui(), -70);
    var parDate = {};
    S.plan.forEach(function (a) {
      (parDate[a.date] = parDate[a.date] || []).push({ date: a.date, heure: a.heure, creneau: a.creneau, idPresence: a.idPresence, code: a.code,
        nom: a.nom, specialite: a.specialite, note: a.note, quartier: a.quartier, commune: a.commune, lieu: a.lieu, statut: a.statut || '', prog: etatJour(a.date) });
    });
    Object.keys(parDate).forEach(function (d) { arch[d] = parDate[d]; });
    Object.keys(arch).forEach(function (d) { if (d < limite) delete arch[d]; });
    LS.set('archives', arch);
  }
  function enAttente() { return S.queue.length + S.fiches.length; }

  function pret() { return !!(S.data && S.data.praticiens && S.data.praticiens.length); }
  function statuts() { return (S.data && S.data.statuts && S.data.statuts.length) ? S.data.statuts : STATUTS_DEFAUT; }
  function quartiers() { return (S.data && S.data.quartiers && S.data.quartiers.length) ? S.data.quartiers : quartiersDefautObjets(); }

  // Contexte du moteur, reconstruit seulement quand les données changent
  var ctxCache = { data: null, ctx: null };
  function ctx() {
    if (ctxCache.data !== S.data) ctxCache = { data: S.data, ctx: Moteur.preparer(Object.assign({}, S.data, { feries: feries() })) };
    return ctxCache.ctx;
  }
  function praticien(code) { return ctx().prat[code]; }

  // ------------------------------------------------------------------ Mise en forme
  var JOURS_COURTS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var ZONES = ['Zone Nord', 'Zone Centre', 'Zone Est', 'Zone Sud', 'Zone Ouest', 'Zone Intérieur'];
  // 3.24.22 : villes de l'intérieur (zone « Zone Intérieur ») : la recherche Google Maps vise la ville, pas Abidjan
  function villeCarte(o) { return o.zone === 'Zone Intérieur' ? 'Côte d\'Ivoire' : 'Abidjan'; }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateCourte(iso) { var p = iso.split('-'); return JOURS_COURTS[jourSemaineIndex(iso)] + ' ' + p[2] + '/' + p[1]; }
  function dateLongue(iso) { var p = iso.split('-'); return nomJour(iso).toLowerCase() + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
  function majuscule(s) { return s.replace(/^./, function (c) { return c.toUpperCase(); }); }
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
  function communesListe() {
    var vus = {}, l = [];
    quartiers().forEach(function (q) { if (!vus[q.commune]) { vus[q.commune] = true; l.push({ commune: q.commune, zone: q.zone }); } });
    return l.sort(function (a, b) { return ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.commune.localeCompare(b.commune, 'fr'); });
  }
  function libelleCommunes(l) {
    if (!l || !l.length) return 'Toutes les communes';
    return l.length <= 3 ? l.join(', ') : l.slice(0, 2).join(', ') + ' et ' + (l.length - 2) + ' autres';
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
  function specialitesListe() {
    var n = {}, prat = ctx().prat;
    Object.keys(prat).forEach(function (k) { var p = prat[k]; if (p.type !== 'Pharmacie' && p.specialite) n[p.specialite] = (n[p.specialite] || 0) + 1; });
    return Object.keys(n).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (k) { return { nom: k, n: n[k] }; });
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
    return '<div class="actions-rapides" role="group" aria-label="Actions rapides">' +
      lien('tel:' + tel, 'tel', 'Appeler', !!tel) + lien('sms:' + tel, 'sms', 'SMS', !!tel) +
      lien('https://wa.me/' + num, 'whatsapp', 'WhatsApp', !!num, true) + lien(gmaps, 'carte', 'Maps', true, true) + '</div>';
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
      return '<button type="button" class="puce" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
        '" data-lib="' + esc(normaliser(op.lib)) + '" aria-pressed="' + actif + '"' + (q && normaliser(op.lib).indexOf(q) < 0 ? ' hidden' : '') + '>' +
        esc(op.lib) + (op.n !== undefined ? '<small>' + op.n + '</small>' : '') + '</button>';
    }
    var nb = o.multiple ? val.length : 0;
    var resume = o.multiple ? (nb ? (nb <= 2 ? val.join(', ') : nb + ' choisis') : (o.resume || 'Tous')) : '';
    var h = '<section class="groupe-filtre' + (ouvert ? ' ouvert' : '') + '" data-groupe="' + o.id + '">' +
      '<div class="groupe-tete">' + (o.repliable ? '<button type="button" class="groupe-bascule" data-a="basculeGroupe" data-v="' + o.id + '" aria-expanded="' + ouvert + '">' : '<div class="groupe-bascule">') +
      '<b>' + esc(o.titre) + '</b>' + (nb ? '<span class="compteur">' + nb + '</span>' : '') + (o.repliable ? '<small>' + esc(resume) + '</small>' + icone('chevron') + '</button>' : '</div>') +
      (o.multiple && ouvert ? '<span class="groupe-actions"><button type="button" class="lien-action" data-a="groupeTout" data-chemin="' + o.chemin + '">Tout</button>' +
        (nb ? '<button type="button" class="lien-action" data-a="groupeAucun" data-chemin="' + o.chemin + '">Effacer</button>' : '') + '</span>' : '') + '</div>';
    if (!ouvert) return h + '</section>';
    if (o.aide) h += '<p class="discret groupe-aide">' + esc(o.aide) + '</p>';
    if (o.recherche) h += '<div class="recherche petite">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="' + o.id + '" placeholder="Rechercher…" value="' +
      esc((f.q && f.q[o.id]) || '') + '" aria-label="Rechercher dans ' + esc(o.titre) + '"></div>';
    if (o.sections) {
      o.sections.forEach(function (sec) {
        h += '<div class="section-choix"><div class="sous-titre-zone"><span>' + esc(sec.titre) + '</span>' +
          (o.multiple ? '<button type="button" class="lien-action" data-a="sectionToute" data-chemin="' + o.chemin + '">Toute la zone</button>' : '') + '</div>' +
          '<div class="puces">' + sec.options.map(puce).join('') + '</div></div>';
      });
    } else h += '<div class="puces">' + o.options.map(puce).join('') + '</div>';
    return h + '</section>';
  }
  function cheminObjet(chemin) {
    var o = S.ui.feuille, k = chemin.split('.');
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    return { o: o, k: k[k.length - 1] };
  }
  function valeurChemin(chemin) { var c = cheminObjet(chemin); return c.o[c.k]; }
  function sectionsCommunes() {
    var secs = [], idx = {};
    communesListe().forEach(function (c) {
      if (idx[c.zone] === undefined) { idx[c.zone] = secs.length; secs.push({ titre: c.zone, options: [] }); }
      secs[idx[c.zone]].options.push({ v: c.commune, lib: c.commune });
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
    var par = {};
    quartiers().forEach(function (q) { (par[q.commune] = par[q.commune] || []).push([q.quartier, q.quartier]); });
    return Object.keys(par).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).map(function (c) { return { titre: c, options: par[c] }; });
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
  // Produits de la gamme (feuille Listes, colonne Produits) proposés en puces ; les autres en saisie libre
  function produitsRef() { return (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT; }
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

  // ------------------------------------------------------------------ Équipe
  function moi() { return String(S.config.delegue || '').trim(); }
  function estMoi(nom) { return String(nom || '').trim().toLowerCase() === moi().toLowerCase(); }
  function arretsCollegues() {
    return ((S.data && S.data.plannings) || []).filter(function (p) { return p.delegue && !estMoi(p.delegue); });
  }
  // Collègues ayant prévu ce praticien la même semaine que la date donnée
  function cibleParCollegues(code, date) {
    var l = lundiDe(date);
    return arretsCollegues().filter(function (p) { return p.code === code && lundiDe(p.date) === l; });
  }
  function etiquetteCollegues(code, date) {
    var l = cibleParCollegues(code, date);
    if (!l.length) return '';
    var v = l.some(function (p) { return p.programme === 'Validé'; });
    return '<span class="etiquette equipe">' + (v ? 'Prévu par ' : 'Envisagé par ') + esc(l[0].delegue) + ', ' + dateCourte(l[0].date) +
      (l.length > 1 ? ' (+' + (l.length - 1) + ')' : '') + '</span>';
  }
  function exclusCollegues(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }
  // Praticiens d'un programme validé par un collègue : jamais proposés, même si l'option « éviter » est désactivée
  function exclusValides(dates) {
    var semaines = {}, ex = {};
    dates.forEach(function (d) { semaines[lundiDe(d)] = true; });
    arretsCollegues().forEach(function (p) { if (p.programme === 'Validé' && semaines[lundiDe(p.date)]) ex[p.code] = true; });
    return ex;
  }

  // ------------------------------------------------------------------ API Google Apps Script
  // Erreur « réessayable » : réseau, délai, serveur occupé ou réponse non JSON (page d'erreur Google)
  function erreur(msg, reessai) { var e = new Error(msg); e.reessai = !!reessai; return e; }
  function appelUnique(url, options) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var minuteur = ctrl ? setTimeout(function () { ctrl.abort(); }, 45000) : null;
    var o = Object.assign({}, options); if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (r) {
      if (!r.ok) throw erreur('Le serveur a répondu ' + r.status + '.', r.status >= 500 || r.status === 429);
      return r.text().then(function (t) {
        try { return JSON.parse(t); } catch (x) { throw erreur('Le serveur est momentanément indisponible.', true); }
      });
    }, function (e) {
      throw erreur(e && e.name === 'AbortError' ? 'Le serveur ne répond pas (délai dépassé).' :
        'Connexion impossible. Vérifiez le réseau.', true);
    }).then(function (j) {
      if (minuteur) clearTimeout(minuteur);
      if (!j || !j.ok) throw erreur((j && j.erreur) || 'Réponse inattendue du serveur.', !!(j && j.reessai));
      return j;
    }, function (e) { if (minuteur) clearTimeout(minuteur); throw e; });
  }
  // Jusqu'à 3 tentatives espacées (1,5 s puis 4 s) pour les erreurs passagères
  function appel(url, options, essai) {
    essai = essai || 0;
    return appelUnique(url, options).catch(function (e) {
      if (!e.reessai || essai >= 2 || !navigator.onLine) throw e;
      return new Promise(function (ok) { setTimeout(ok, essai ? 4000 : 1500); }).then(function () { return appel(url, options, essai + 1); });
    });
  }
  function apiGet(action, cfg) {
    cfg = cfg || S.config;
    return appel(cfg.url + (cfg.url.indexOf('?') < 0 ? '?' : '&') + 'action=' + action +
                 '&token=' + encodeURIComponent(cfg.token) + '&_=' + Date.now(), { method: 'GET' });
  }
  function apiPost(action, payload) {
    var body = { token: S.config.token, action: action };
    Object.keys(payload).forEach(function (k) { body[k] = payload[k]; });
    return appel(S.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  }
  function connecte() { return !S.config.demo && !!S.config.url; }

  // Tournée publiée : remplace la précédente sur toute la période concernée
  function porteePlan() {
    var d = S.plan.map(function (a) { return a.date; }).sort();
    return d.length ? { debut: d[0], fin: d[d.length - 1] } : null;
  }
  function chargePlan() {
    // 3.24.9 : avant toute publication, les jours connus (archives, base, comptes rendus) sont repris :
    // la base n'efface plus un jour simplement absent du téléphone
    importerAgenda();
    var p = porteePlan() || { debut: aujourdhui(), fin: aujourdhui() }, ancien = S.ui.portee;
    if (ancien) { if (ancien.debut < p.debut) p.debut = ancien.debut; if (ancien.fin > p.fin) p.fin = ancien.fin; }
    // agenda importé : la base reflète exactement mes 7 derniers jours et tout l'à venir
    if (LS.get('agendaImporte', false)) { var lim = ajouterJours(aujourdhui(), -7); if (lim < p.debut) p.debut = lim; }
    return { delegue: moi(), debut: p.debut, fin: p.fin, arrets: S.plan.map(function (a) {
      var prog = jourConfirme(a.date) ? 'Validé' : 'Proposition';
      return { date: a.date, heure: a.heure, creneau: a.creneau, debut: a.debut, fin: a.fin, idPresence: a.idPresence,
               code: a.code, nom: a.nom, specialite: a.specialite, note: a.note, quartier: a.quartier, commune: a.commune,
               lieu: a.lieu, statut: a.statut, etat: a.etat, programme: prog, uid: a.uid };
    }) };
  }
  function publierPlan(sansModif) {
    marquerModifie(sansModif);
    if (!connecte()) return;
    S.ui.aPublier = true; LS.set('aPublier', true);
    synchroniser(true);
  }

  var minuteurReprise;
  function synchroniser(silencieux) {
    if (!connecte()) return Promise.resolve();
    if (S.ui.enCours) return Promise.resolve();
    if (!navigator.onLine) { S.ui.sync = 'horsligne'; afficherEntete(); return Promise.resolve(); }
    S.ui.enCours = true; S.ui.sync = 'encours'; afficherEntete();
    var tentePub = false;
    // 1. fiches praticiens (codes définitifs), 2. comptes rendus, 3. tournée, 4. données à jour
    var envoi = envoyerFiches().then(function () {
      return S.queue.length ? apiPost('valider', { visites: S.queue }).then(function (r) {
        var recus = {}; (r.recus || []).forEach(function (u) { recus[u] = true; });
        S.queue = S.queue.filter(function (v) { return !recus[v.uid]; });
        LS.set('queue', S.queue);
      }) : null;
    });
    return envoi.then(function () { return envoyerRapportsEnAttente(); }).then(function () {
      if (!S.ui.aPublier || !moi()) return;
      tentePub = true;
      return apiPost('planning', chargePlan()).then(function (r) {
        S.ui.aPublier = false; LS.set('aPublier', false);
        S.ui.portee = porteePlan(); LS.set('portee', S.ui.portee);
        S.ui.conflits = r.conflits || [];
      });
    }).then(function () {
      // synchro allégée : empreinte des données de référence et date de la dernière visite connue
      var ref = S.data && S.data.sig && S.data.praticiens ? '&sig=' + encodeURIComponent(S.data.sig) : '';
      var hd = S.data && S.data.historique && S.data.historique.length ? S.data.historique.reduce(function (m, v) { return v.horodatage > m ? v.horodatage : m; }, '') : '';
      return apiGet('data' + ref + (hd ? '&hdepuis=' + encodeURIComponent(hd) : ''));
    }).then(function (d) {
      var ancien = S.data || {};
      var hist = d.historique || [];
      if (d.partiel) {
        var vus = {}; hist.forEach(function (v) { vus[v.uid] = true; });
        hist = hist.concat((ancien.historique || []).filter(function (v) { return !v.uid || !vus[v.uid]; }));
        hist.sort(function (a, b) { return String(b.horodatage || b.date) < String(a.horodatage || a.date) ? -1 : 1; });
        hist = hist.slice(0, 1500);
      }
      var base = d.inchange ? ancien : d;
      // nom de délégué fusionné dans la base (ex. adresse e-mail saisie comme nom) : ce téléphone prend le bon nom
      if (d.alias && moi()) Object.keys(d.alias).forEach(function (k) {
        if (k.toLowerCase() === moi().toLowerCase()) { S.config.delegue = d.alias[k]; LS.set('config', S.config); S.ui.aPublier = true; LS.set('aPublier', true); }
      });
      S.data = { version: d.version, sig: d.sig, praticiens: base.praticiens, presences: base.presences, quartiers: base.quartiers,
                 statuts: base.statuts, delegues: base.delegues || [], feries: base.feries || [], activites: base.activites || [], activitesPharmacie: base.activitesPharmacie || [], produits: base.produits || [], fiches: base.fiches || [],
                 historique: hist, plannings: d.plannings || [], rapports: d.rapports || ancien.rapports || [], syncedAt: new Date().toISOString(),
                 sauvegarde: d.sauvegarde || ancien.sauvegarde || '' };
      S.queue.forEach(function (v) { Moteur.appliquerVisite(S.data.praticiens, v, S.data.statuts); });
      S.fiches.forEach(function (f) { appliquerFiche(f.praticien, f.presences); });
      LS.set('data', S.data);
      S.ui.sync = 'ok'; S.ui.erreur = ''; clearTimeout(minuteurReprise);
      // 3.23.3 : plus d'alerte « prévus par un collègue » ; l'étiquette « Prévu par … » de chaque ligne de Planifier suffit
      S.ui.conflits = [];
      if (!silencieux) toast('Données à jour : ' + S.data.praticiens.length + ' praticiens.');
    }).catch(function (e) {
      S.ui.sync = 'erreur'; S.ui.erreur = e.message;
      if (!silencieux) toast(e.message + (enAttente() ? ' Vos saisies sont conservées et seront renvoyées automatiquement.' : ''), 5000);
      // nouvelle tentative discrète 30 s plus tard
      clearTimeout(minuteurReprise);
      minuteurReprise = setTimeout(function () { if (navigator.onLine) synchroniser(true); }, 30000);
    }).then(function () {
      S.ui.enCours = false;
      importerAgenda();
      rendreSiPossible();
      if (S.ui.aPublier && !tentePub && navigator.onLine) setTimeout(function () { synchroniser(true); }, 400);
    });
  }

  // Fiches praticiens saisies sur le téléphone, envoyées une par une (dans l'ordre de saisie)
  function envoyerFiches() {
    if (!S.fiches.length) return Promise.resolve();
    var f = S.fiches[0];
    if (!f.uid) { f.uid = 'F' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); LS.set('fiches', S.fiches); }
    return apiPost('fiche', { uid: f.uid, praticien: f.praticien, presences: f.presences }).then(function (r) {
      S.fiches.shift();
      if (r.ancien && r.code && r.ancien !== r.code) remplacerCode(r.ancien, r.code);
      if (r.ids) remplacerIds(r.ids);
      LS.set('fiches', S.fiches); LS.set('plan', S.plan); LS.set('imposes', S.imposes); LS.set('queue', S.queue);
      return envoyerFiches();
    }, function (e) {
      // Serveur pas encore mis à jour (pas d'action « fiche ») : les fiches restent en attente sur le téléphone,
      // sans bloquer l'envoi des comptes rendus ni la tournée
      if (/Action inconnue/i.test(e.message)) { S.ui.serveurAncien = true; return; }
      throw e;
    });
  }
  function remplacerCode(ancien, code) {
    S.plan.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.imposes.forEach(function (a) { if (a.code === ancien) a.code = code; });
    if (S.ui.contactOuvert === ancien) S.ui.contactOuvert = code;
    S.queue.forEach(function (a) { if (a.code === ancien) a.code = code; });
    S.fiches.forEach(function (f) {
      if (f.praticien.code === ancien) f.praticien.code = code;
      f.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    });
    if (S.data) {
      S.data.praticiens.forEach(function (x) { if (x.code === ancien) x.code = code; });
      S.data.presences.forEach(function (x) { if (x.code === ancien) x.code = code; });
    }
    ctxCache.data = null;
  }
  function remplacerIds(ids) {
    Object.keys(ids).forEach(function (ancien) {
      var nouveau = String(ids[ancien]);
      if (ancien === nouveau) return;
      S.plan.forEach(function (a) {
        if (String(a.idPresence) !== ancien) return;
        a.idPresence = nouveau;
        if (a.cle) a.cle = nouveau + a.cle.slice(a.cle.indexOf('|'));
      });
      S.imposes.forEach(function (im) { if (im.cle && im.cle.split('|')[0] === ancien) im.cle = nouveau + im.cle.slice(im.cle.indexOf('|')); });
      S.queue.forEach(function (v) { if (String(v.idPresence) === ancien) v.idPresence = nouveau; });
      S.fiches.forEach(function (f) { f.presences.forEach(function (x) { if (String(x.id) === ancien) x.id = nouveau; }); });
    });
  }

  // Mise à jour légère : tournées des collègues seulement
  function rafraichirEquipe() {
    if (!connecte() || !navigator.onLine || !S.data || S.ui.enCours) return Promise.resolve(false);
    return apiGet('equipe').then(function (r) {
      // les tournées plus anciennes (statistiques du mois) sont conservées
      var depuis = r.depuis || ajouterJours(aujourdhui(), -14);
      S.data.plannings = (S.data.plannings || []).filter(function (p) { return p.date < depuis; }).concat(r.plannings || []);
      // listes de la base (produits retirés ou ajoutés, activités, statuts, délégués) prises en compte sans attendre la synchronisation complète
      if (r.listes) ['produits', 'activites', 'activitesPharmacie', 'delegues', 'statuts'].forEach(function (k) { if (r.listes[k] && r.listes[k].length) S.data[k] = r.listes[k]; });
      LS.set('data', S.data);
      return true;
    }).catch(function () { return false; });
  }

  // ------------------------------------------------------------------ En-tête, barre, navigation
  function afficherEntete() {
    var t = aujourdhui();
    var moisCourts = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
    $('enteteDate').textContent = majuscule(JOURS_COURTS[jourSemaineIndex(t)]) + ' ' + (+t.slice(8)) + ' ' + moisCourts[+t.slice(5, 7) - 1] + (moi() ? ' · ' + moi() : '');
    var p = $('pastilleSync'), etat, texte;
    if (S.config.demo) { etat = 'demo'; texte = 'Démo'; }
    else if (!S.config.url) { etat = 'erreur'; texte = 'Non connecté'; }
    else if (S.ui.sync === 'encours') { etat = 'encours'; texte = 'Synchro…'; }
    else if (!navigator.onLine || S.ui.sync === 'horsligne') { etat = 'horsligne'; texte = enAttente() ? enAttente() + ' en attente' : 'Hors ligne'; }
    else if (S.ui.sync === 'erreur') { etat = 'erreur'; texte = 'Erreur synchro'; }
    else if (enAttente()) { etat = 'attente'; texte = enAttente() + ' en attente'; }
    else { etat = 'ok'; texte = S.data && S.data.syncedAt ? 'À jour ' + new Date(S.data.syncedAt).toTimeString().slice(0, 5) : 'À jour'; }
    p.dataset.etat = etat; p.innerHTML = '<span>' + esc(texte) + '</span>' + (etat === 'demo' ? '' : icone('relancer'));
    p.setAttribute('aria-label', 'Synchronisation : ' + texte + (S.ui.erreur ? '. ' + S.ui.erreur : ''));
  }
  function afficherBarre() {
    var att = S.plan.filter(function (a) { return a.statut && a.etat !== 'valide'; }), n = att.length;
    // inutile si le seul compte rendu en attente est celui de la carte ouverte (qui a son propre bouton)
    var visible = S.ui.tab === 'jour' && n > 0 && !S.ui.feuille && !(n === 1 && S.ui.ouvert === att[0].uid);
    $('barreValider').hidden = !visible;
    document.body.classList.toggle('avec-barre', visible);
    $('boutonValider').textContent = n > 1 ? 'Enregistrer les ' + n + ' comptes rendus' : 'Enregistrer le compte rendu';
  }
  function afficherNav() {
    document.querySelectorAll('.navigation button').forEach(function (b) {
      var actif = S.ui.tab === 'autour' || S.ui.tab === 'rapport' ? 'jour' : S.ui.tab;
      if (b.dataset.tab === actif) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
  }

  // ------------------------------------------------------------------ Rendu
  function rendre() {
    var tab = S.ui.tab;
    // onglet mémorisé : l'application rouvre là où l'on était (rafraîchissement, mise à jour, relance)
    if (VUES[tab] && tab !== 'accueil' && tab !== 'identite' && LS.get('onglet', '') !== tab) LS.set('onglet', tab);
    // jour affiché mémorisé : un rafraîchissement ne ramène plus au lundi (valable jusqu'à minuit)
    if (S.ui.jour || S.ui.jourVue) LS.set('jourVu', { j: S.ui.jour, v: S.ui.jourVue || null, le: aujourdhui() });
    LS.set('proches', S.ui.pharmaciesProches || false);
    if (!pret() && tab !== 'reglages') tab = 'accueil';
    else if (pret() && connecte() && !moi() && tab !== 'reglages') tab = 'identite';
    cacherInfobulle();
    cartesAFaire = [];
    // 3.24.14 : un rafraîchissement du même écran (synchronisation, minuterie) ne rejoue aucune animation
    // et garde la position de lecture : l'écran ne bouge plus
    var vue = $('vue'), y = window.scrollY;
    vue.classList.remove('vue-entre');
    vue.innerHTML = (VUES[tab] || VUES.jour)();
    animerRendu(tab);
    if (!vue.classList.contains('vue-entre') && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    centrerBandeJours();
    dessinerCartes();
    rendreFeuille();
    rendreLancement();
    afficherEntete(); afficherBarre(); afficherNav();
    datesEnFrancais();
  }
  // 3.19.0 : animations discrètes, seulement quand quelque chose change vraiment
  // (nouvel écran, nouvelle question d'un parcours, carte qu'on vient d'ouvrir, compte rendu qu'on vient d'enregistrer)
  function animerRendu(tab) {
    var v = $('vue'), cle = tab + '|' + (S.ui.rechOuverte ? 1 : 0) + '|' + (S.ui.voirParams ? 1 : 0) + '|' + (S.ui.jourVue || S.ui.jour || '');
    var nouvelEcran = cle !== S.ui.cleVue;
    if (nouvelEcran) {
      void v.offsetWidth; v.classList.add('vue-entre'); S.ui.cleVue = cle;
      // 3.24.0 : les cartes, lignes et indicateurs arrivent l'un après l'autre (cascade)
      v.querySelectorAll('.arret, .ligne-plan, .liste > .element, .kpi, .ligne-gamme, .tuile, .bj-jour').forEach(function (el, i) { el.style.setProperty('--i', Math.min(i, 14)); });
      if (!reduireAnimations()) compterChiffres(v);
    }
    // la prochaine visite du jour respire (anneau qui pulse sur la ligne du temps)
    var t = aujourdhui(), now = minutesMaintenant(), proch = S.plan.filter(function (x) { return x.date === t && !x.statut && (heureVersMinutes(x.heure) === null || heureVersMinutes(x.heure) >= now - 20); })[0];
    if (proch && tab === 'jour') { var bp = v.querySelector('.arret .carte-bouton[data-uid="' + proch.uid + '"]'); if (bp) bp.closest('.arret').classList.add('prochaine'); }
    if (tab !== S.ui.ongletAnime) {
      var nb = document.querySelector('.navigation button[aria-current="page"]');
      if (nb) { nb.classList.remove('rebond'); void nb.offsetWidth; nb.classList.add('rebond'); }
      S.ui.ongletAnime = tab;
    }
    var bpx = v.querySelector('.bandeau-proche'), kp = bpx ? bpx.textContent : '';
    if (bpx && kp !== S.ui.cleProche) bpx.classList.add('nouveau');
    S.ui.cleProche = kp;
    var q = v.querySelector('.cr-question .etape-titre'), kq = q ? q.textContent : '';
    if (q && kq !== S.ui.cleQuestion) q.parentNode.classList.add('nouvelle');
    S.ui.cleQuestion = kq;
    var o = v.querySelector('.arret.ouvert');
    if (o && S.ui.ouvert !== S.ui.dernierOuvert) o.classList.add('vient-ouvrir');
    S.ui.dernierOuvert = S.ui.ouvert;
    if (S.ui.flashOk) { var f = S.ui.flashOk; setTimeout(function () { if (S.ui.flashOk === f) S.ui.flashOk = null; }, 900); }
  }
  // chiffres des indicateurs qui défilent de 0 à leur valeur
  function compterChiffres(v) {
    v.querySelectorAll('.kpi > b, .chiffre > b, .sj-taux > b').forEach(function (b) {
      var txt = b.textContent, m = txt.match(/^(\d+)(.*)$/); if (!m || +m[1] < 2) return;
      var fin = +m[1], suite = m[2], debut = performance.now();
      (function pas(t) {
        var p = Math.min(1, (t - debut) / 700), e = 1 - Math.pow(1 - p, 3);
        b.textContent = Math.round(fin * e) + suite;
        if (p < 1) requestAnimationFrame(pas);
      })(debut);
    });
  }
  // onde au toucher des boutons
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.bouton, .puce, .tuile, .bj-jour, .pastille-produit');
    if (!b || reduireAnimations()) return;
    var r = b.getBoundingClientRect(), o = document.createElement('span'), s = Math.max(r.width, r.height);
    o.className = 'onde'; o.style.width = o.style.height = s + 'px';
    o.style.left = (e.clientX - r.left - s / 2) + 'px'; o.style.top = (e.clientY - r.top - s / 2) + 'px';
    b.appendChild(o); setTimeout(function () { o.remove(); }, 600);
  }, { passive: true });
  // bande des jours : le jour choisi glisse au centre (depuis la position précédente, pour garder le mouvement)
  function centrerBandeJours() {
    var b = document.querySelector('.bj-jours'), s = b && b.querySelector('.bj-jour[aria-pressed="true"]');
    if (!s) return;
    var cible = s.offsetLeft - (b.clientWidth - s.offsetWidth) / 2;
    if (S.ui.bjDepart !== undefined && S.ui.bjDepart !== null) {
      b.scrollLeft = s.offsetLeft - S.ui.bjDepart; S.ui.bjDepart = null;
      try { b.scrollTo({ left: cible, behavior: reduireAnimations() ? 'auto' : 'smooth' }); } catch (e) { b.scrollLeft = cible; }
    } else b.scrollLeft = cible;
  }
  function reduireAnimations() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  // Calendriers : affichage français JJ-Mmm-AAAA (ex. 26-Oct-2026), quel que soit le réglage du téléphone.
  // Le sélecteur natif reste dessous (transparent) : toucher la date ouvre le calendrier du téléphone.
  var MOIS_ABREGES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  function dateFr(iso) { var p = String(iso || '').slice(0, 10).split('-'); return p.length === 3 ? p[2] + '-' + MOIS_ABREGES[+p[1] - 1] + '-' + p[0] : ''; }
  function datesEnFrancais() {
    document.querySelectorAll('input[type="date"]:not([data-fr])').forEach(function (inp) {
      inp.setAttribute('data-fr', '1'); inp.setAttribute('lang', 'fr');
      var cadre = document.createElement('span'), texte = document.createElement('span');
      cadre.className = 'date-fr'; texte.className = 'date-fr-texte';
      inp.parentNode.insertBefore(cadre, inp); cadre.appendChild(texte); cadre.appendChild(inp);
      var maj = function () { texte.textContent = inp.value ? dateFr(inp.value) : 'JJ-Mmm-AAAA'; texte.classList.toggle('vide', !inp.value); };
      maj();
      inp.addEventListener('input', maj); inp.addEventListener('change', maj);
      inp.addEventListener('click', function () { try { inp.showPicker(); } catch (e) {} });
    });
  }
  function rendreSiPossible() {
    var a = document.activeElement;
    if (a && (($('vue').contains(a)) || $('feuille').contains(a)) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { afficherEntete(); afficherBarre(); return; }
    rendre();
  }
  var VUES = {};

  // ------------------------------------------------------------------ Vue : accueil et identité
  VUES.accueil = function () {
    return '<section class="accueil">' +
      '<img src="icon-192.png" alt="" width="64" height="64" style="border-radius:16px;margin:6px 0 18px">' +
      '<h1>Votre tournée, construite sur le planning de chaque médecin.</h1>' +
      '<p>L\'application choisit les praticiens selon leur potentiel et la date de votre dernière visite, vérifie qu\'ils sont ' +
      'présents au bon endroit et à la bonne heure, et évite ceux que vos collègues ont déjà ciblés. Elle fonctionne aussi sans réseau.</p>' +
      '<button class="bouton bouton-plein" data-a="nav" data-tab="reglages" type="button">Connecter mon Google Sheet</button>' +
      '<button class="bouton" data-a="demo" type="button">Essayer avec des données de démonstration</button></section>';
  };
  VUES.identite = function () {
    return '<section class="accueil"><h1>Qui êtes-vous ?</h1>' +
      '<p>Votre nom apparaît auprès de vos collègues, sur votre tournée et vos visites. Il permet à chacun de savoir quels praticiens sont déjà ciblés.</p>' +
      champNom('nomDelegue', moi(), 'Votre nom') +
      '<label class="champ"><span>Votre numéro WhatsApp (facultatif)</span><input type="tel" id="numWhatsapp" inputmode="tel" placeholder="Ex. 07 07 07 07 07"></label>' +
      '<button class="bouton bouton-plein" data-a="enregistrerNom" type="button">Continuer</button></section>';
  };

  // ------------------------------------------------------------------ Période et paramètres
  // Jours fériés : calendrier officiel de la Côte d'Ivoire (date.nager.at, mis en cache sur le téléphone)
  // + jours ajoutés dans la feuille Listes (fêtes musulmanes, ponts…)
  var NOMS_FERIES = { "New Year's Day": 'Jour de l\'An', 'Easter Monday': 'Lundi de Pâques', 'Labour Day': 'Fête du Travail',
    'Ascension Day': 'Ascension', 'Whit Monday': 'Lundi de Pentecôte', 'Independence Day': 'Fête de l\'Indépendance',
    'Assumption Day': 'Assomption', 'All Saints Day': 'Toussaint', 'National Peace Day': 'Journée nationale de la Paix', 'Christmas Day': 'Noël' };
  var memoFeries = { cle: null, m: null };
  function feriesMap() {
    var cal = LS.get('feriesCal', null), cle = (cal ? cal.t : 0) + '|' + ((S.data && S.data.feries) || []).join(',');
    if (memoFeries.cle === cle) return memoFeries.m;
    var m = {};
    if (!cal) FERIES_DEFAUT.forEach(function (d) { m[d] = 'Jour férié'; });
    else Object.keys(cal.m).forEach(function (d) { m[d] = cal.m[d]; });
    ((S.data && S.data.feries) || []).forEach(function (d) { if (!m[d]) m[d] = 'Jour férié'; });
    memoFeries = { cle: cle, m: m };
    return m;
  }
  function feries() { return Object.keys(feriesMap()); }
  function estFerie(d) { return !!feriesMap()[d]; }
  function nomFerie(d) { return feriesMap()[d] || ''; }
  function chargerFeriesCalendrier() {
    var cal = LS.get('feriesCal', null);
    if (!navigator.onLine || (cal && Date.now() - cal.t < 7 * 86400000)) return;
    var an = +aujourdhui().slice(0, 4);
    Promise.all([an, an + 1].map(function (y) { return fetch('https://date.nager.at/api/v3/PublicHolidays/' + y + '/CI').then(function (r) { return r.json(); }); }))
      .then(function (l) {
        var m = {};
        l.forEach(function (a) { a.forEach(function (x) { m[x.date] = NOMS_FERIES[x.name] || x.localName || x.name; }); });
        if (!Object.keys(m).length) return;
        LS.set('feriesCal', { t: Date.now(), m: m }); ctxCache.data = null; rendreSiPossible();
      }).catch(function () {});
  }
  function bandeauFeries(dates) {
    var l = dates.filter(estFerie);
    if (!l.length) return '';
    return '<div class="bandeau info">' + icone('calendrier') + '<p><b>Jour' + (l.length > 1 ? 's' : '') + ' férié' + (l.length > 1 ? 's' : '') + '</b> : ' +
      l.map(function (d) { return dateCourte(d) + ', ' + esc(nomFerie(d)); }).join(' ; ') + '. Aucune visite n\'est prévue ce' + (l.length > 1 ? 's jours-là' : ' jour-là') + '.</p></div>';
  }
  // 3.17.0 : visites déjà présentes un jour donné, à ne jamais écraser par une nouvelle planification :
  // tournée en cours (toute si elle est confirmée, sinon les visites renseignées, gardées ou imposées),
  // sinon programme archivé ou publié (confirmé) et comptes rendus de ce jour
  function vraiStatut(s) { return s && s !== 'À faire' ? s : ''; }
  function versPlan(x, v, d) {
    var s = v || x, x2 = x || {}, pr = praticien(s.code) || {}, c = creneauDe(s.code, d, s.idPresence || x2.idPresence, s.creneau || x2.creneau);
    var st = v ? v.statut || '' : vraiStatut(x2.statut);
    return completerHeures({ uid: (v && v.uid) || x2.uid || ('C-' + d + '-' + s.code), date: d, heure: x2.heure || (v && v.heure) || '', creneau: s.creneau || x2.creneau || (c ? c.creneau : ''),
      debut: x2.debut || '', fin: x2.fin || '', idPresence: s.idPresence || x2.idPresence || '', code: s.code, nom: s.nom || pr.nom || s.code, type: pr.type || s.type || 'Médecin',
      specialite: s.specialite || pr.specialite || '', note: pr.note || s.note, conventionne: pr.conventionne, quartier: s.quartier || x2.quartier || '', commune: s.commune || x2.commune || '',
      lieu: s.lieu || x2.lieu || '', lat: c && c.coord ? c.coord.lat : null, lon: c && c.coord ? c.coord.lon : null, statut: st,
      activite: v ? v.activite || '' : '', produits: v ? v.produits || '' : '', commentaire: v ? v.commentaire || '' : '', prochaine: v ? String(v.prochaine || '').slice(0, 10) : '',
      etat: st ? 'valide' : '', garde: true, impose: false, rdv: '', dist: 0, retard: false });
  }
  function donneesJour(d, tout) {
    var dansPlan = S.plan.filter(function (a) { return a.date === d; });
    if (dansPlan.length) return dansPlan.filter(function (a) { return tout || jourConfirme(d) || a.statut || a.etat === 'valide' || a.garde || a.impose || a.corrige; });
    var prevus = programmeDuJour(d).filter(function (x) {
      return tout || vraiStatut(x.statut) || (x.prog ? x.prog === 'valide' : x.programme !== 'Proposition');
    });
    var faites = visitesConnues().filter(function (v) { return String(v.date || '').slice(0, 10) === d && (!v.delegue || estMoi(v.delegue)) && v.code; });
    var parCode = {}; faites.forEach(function (v) { parCode[v.code] = v; });
    var l = prevus.map(function (x) { return versPlan(x, parCode[x.code], d); });
    faites.forEach(function (v) { if (!prevus.some(function (x) { return x.code === v.code; })) l.push(versPlan(null, v, d)); });
    var vus = {};
    return l.filter(function (a) { if (vus[a.code]) return false; vus[a.code] = true; return true; });
  }
  function bandeauDejaPlanifie(dates) {
    var l = dates.map(function (d) { return { d: d, n: donneesJour(d).length }; }).filter(function (x) { return x.n; });
    if (!l.length) return '';
    return '<div class="bandeau info deja-planifie">' + icone('calendrier') + '<p><b>Déjà planifié</b><br>' +
      l.map(function (x) { return majuscule(dateCourte(x.d)) + ' : ' + x.n + ' visite' + (x.n > 1 ? 's' : ''); }).join('<br>') +
      '<br><span class="discret">Ces visites restent en place ; seuls les créneaux libres seront complétés.</span></p></div>';
  }
  function prochainFerie() {
    var t = aujourdhui(), l = feries().filter(function (d) { return d >= t; }).sort();
    return l.length ? l[0] : '';
  }
  // Dates de la période (affichage) et dates travaillées (jours fériés exclus) pour le tirage
  // 3.24.23 : on ne planifie jamais un jour passé ; une semaine entamée ne garde que ses jours à venir
  function dateRefValide() {
    var p = S.params, t = aujourdhui();
    if (!p.dateRef || p.dateRef < t && (p.mode === 'jour' || joursOuvres(lundiDe(p.dateRef))[4] < t)) { p.dateRef = t; LS.set('params', p); }
    return p.dateRef;
  }
  function datesAffichees() {
    var p = S.params, t = aujourdhui(), r = dateRefValide();
    return (p.mode === 'jour' ? [r] : joursOuvres(lundiDe(r))).filter(function (d) { return d >= t; });
  }
  function datesPeriode() { return datesAffichees().filter(function (d) { return !estFerie(d); }); }
  function communesPour(date) {
    var p = S.params, l = p.communes;
    if (p.mode === 'semaine' && p.parJour) {
      var j = p.communesJour[jourSemaineIndex(date)];
      if (j && j.length) l = j;
    }
    return l && l.length ? l : null;
  }
  function departCoord() {
    var q = quartiers().filter(function (x) { return x.quartier === S.config.depart; })[0];
    return q ? { lat: q.lat, lon: q.lon } : null;
  }

  // ------------------------------------------------------------------ Vues du parcours : Aujourd'hui (terrain) et Planifier (préparation)
  function datesPlan() { return Array.from(new Set(S.plan.map(function (a) { return a.date; }))).sort(); }
  // 3.24.23 : Planifier ne montre qu'aujourd'hui et l'à venir ; les jours passés restent en mémoire (Aujourd'hui, Reprendre un ancien programme)
  function datesPlanAvenir() { var t = aujourdhui(); return datesPlan().filter(function (d) { return d >= t; }); }
  function etatJour(d) { return S.jours[d] && S.jours[d].etat === 'valide' ? 'valide' : 'proposition'; }
  function jourConfirme(d) { return etatJour(d) === 'valide'; }
  function joursBrouillon() { return datesPlanAvenir().filter(function (d) { return !jourConfirme(d); }); }
  function mettreBrouillon(dates) { dates.forEach(function (d) { S.jours[d] = { etat: 'proposition', valideLe: '', modifieLe: '' }; }); }
  function signatureJour(d) { return S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code + '@' + a.heure; }).sort().join(','); }
  function confirmerJours(dates) {
    var h = horodatageCourt(), sig = LS.get('signJours', {});
    dates.forEach(function (d) { S.jours[d] = { etat: 'valide', valideLe: h, modifieLe: '' }; sig[d] = signatureJour(d); });
    LS.set('signJours', sig);
  }
  // un jour confirmé dont le contenu a changé depuis la dernière publication est daté « modifié le »
  function marquerModifie(sansModif) {
    var sig = LS.get('signJours', {}), h = horodatageCourt();
    datesPlan().forEach(function (d) {
      var s = signatureJour(d);
      if (!sansModif && jourConfirme(d) && sig[d] !== undefined && sig[d] !== s) S.jours[d].modifieLe = h;
      sig[d] = s;
    });
    LS.set('signJours', sig);
  }
  // fenêtre de l'agenda : 7 jours passés (les comptes rendus non envoyés restent), états alignés sur les jours présents
  function nettoyerAgenda() {
    var lim = ajouterJours(aujourdhui(), -7);
    S.plan = S.plan.filter(function (a) { return a.date >= lim || (a.statut && a.etat !== 'valide'); });
    var present = ensemble(datesPlan()), retires = LS.get('joursRetires', {});
    // 3.24.9 : un jour qui disparaît n'est plus noté « retiré » d'office (il revenait vide après certaines mises à jour) ;
    // seul un retrait volontaire (dernière visite du jour retirée) l'écarte de l'import
    Object.keys(S.jours).forEach(function (d) { if (!present[d]) delete S.jours[d]; });
    Object.keys(retires).forEach(function (d) { if (present[d] || d < lim) delete retires[d]; });
    LS.set('joursRetires', retires);
    datesPlan().forEach(function (d) { if (!S.jours[d]) S.jours[d] = { etat: 'proposition', valideLe: '', modifieLe: '' }; });
  }
  // migration : les jours confirmés d'avant l'agenda (programme archivé ou publié, comptes rendus) rejoignent l'agenda
  // 3.22.2 : tout jour de la fenêtre qui a au moins une donnée (tournée archivée ou publiée, brouillon compris,
  // ou compte rendu) apparaît d'office dans l'agenda, à chaque ouverture et après chaque synchronisation.
  // Un jour vidé volontairement (toutes ses visites retirées) n'est pas réimporté.
  // 3.24.2 : lieu, quartier, commune et GPS d'une visite suivent la base : une officine ou un cabinet
  // déplacé (ou des coordonnées corrigées) dans la feuille se reflète à l'écran dès la synchronisation
  function actualiserLieux() {
    var C = ctx(), t0 = ajouterJours(aujourdhui(), -7), change = false, futur = false;
    function maj(a) {
      if (!a || !a.code || String(a.date || '') < t0) return;
      var l = C.parCode[a.code] || [], vus = {}, pres = [];
      l.forEach(function (c) { if (!vus[c.idPresence]) { vus[c.idPresence] = true; pres.push(c); } });
      var c = (a.idPresence && pres.filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0]) || (pres.length === 1 ? pres[0] : null);
      var p = C.prat[a.code];
      var n = c ? { lieu: c.lieu || '', quartier: c.quartier || '', commune: c.commune || '', lat: c.coord ? c.coord.lat : null, lon: c.coord ? c.coord.lon : null } : {};
      if (p && p.nom) n.nom = p.nom;
      Object.keys(n).forEach(function (k) {
        var av = a[k] === undefined || a[k] === null ? '' : String(a[k]), ap = n[k] === undefined || n[k] === null ? '' : String(n[k]);
        if (k === 'lat' || k === 'lon') { av = av === '' ? '' : (+av).toFixed(6); ap = ap === '' ? '' : (+ap).toFixed(6); }
        if (av !== ap) { a[k] = n[k]; change = true; if (a.date >= aujourdhui()) futur = true; }
      });
    }
    S.plan.forEach(maj); (S.horsPlan || []).forEach(maj);
    if (!change) return false;
    LS.set('horsPlan', S.horsPlan || []); sauver();
    if (futur && moi()) { S.ui.aPublier = true; LS.set('aPublier', true); }
    return true;
  }
  function importerAgenda() {
    if (!pret()) return 0;
    actualiserLieux();
    var t = aujourdhui(), n = 0, deja = ensemble(datesPlan()), retires = LS.get('joursRetires', {});
    for (var k = -7; k <= 70; k++) {
      var d = ajouterJours(t, k);
      if (deja[d] || retires[d] || jourSemaineIndex(d) > 4) continue;
      var src = programmeDuJour(d), l = donneesJour(d, true);
      if (!l.length) continue;
      var confirme = src.some(function (x) { return x.prog ? x.prog === 'valide' : x.programme === 'Validé'; }) || l.some(function (x) { return x.statut; });
      l = l.map(function (x) {
        var h = (S.horsPlan || []).filter(function (y) { return y.date === d && y.code === x.code; })[0];
        if (!h) return x;
        S.horsPlan = S.horsPlan.filter(function (y) { return y !== h; });
        var c = Object.assign({}, h); delete c.hors; delete c.horsTournee; c.garde = true; return c;
      });
      S.plan = S.plan.concat(l); S.jours[d] = { etat: confirme ? 'valide' : 'proposition', valideLe: '', modifieLe: '' }; n++;
    }
    LS.set('agendaImporte', true);
    if (!n) return 0;
    LS.set('horsPlan', S.horsPlan || []);
    trierPlan(); sauver();
    return n;
  }
  function choisirJour(dates) {
    if (!S.ui.jour || dates.indexOf(S.ui.jour) < 0) {
      var t = aujourdhui();
      S.ui.jour = dates.indexOf(t) >= 0 ? t : (dates.filter(function (d) { return d >= t; })[0] || dates[0]);
    }
  }
  function barreJours(dates) {
    return '<div class="jours" role="group" aria-label="Jour">' + dates.map(function (d) {
      var n = S.plan.filter(function (a) { return a.date === d; });
      var faits = n.filter(function (a) { return a.etat === 'valide'; }).length;
      return '<button type="button" class="jour' + (d === aujourdhui() ? ' aujourdhui' : '') + '" data-a="jour" data-v="' + d +
        '" aria-pressed="' + (d === S.ui.jour) + '"><b>' + JOURS_COURTS[jourSemaineIndex(d)].replace('.', '') + ' ' + (+d.slice(8)) +
        '</b><small>' + (faits ? faits + '/' : '') + n.length + ' visite' + (n.length > 1 ? 's' : '') + '</small></button>';
    }).join('') + '</div>';
  }
  // 3.24.3 : repère du jour affiché par rapport à aujourd'hui, chacun sa couleur
  // (avant-hier et hier en bleu, aujourd'hui en vert, demain et après-demain en ambre)
  function etiquetteRelative(d) {
    var t = aujourdhui(), m = { '-2': ['Avant-hier', 'rel-passe2'], '-1': ['Hier', 'rel-passe'], '0': ['Aujourd\'hui', 'ok'], '1': ['Demain', 'rel-futur'], '2': ['Après-demain', 'rel-futur2'] };
    for (var k = -2; k <= 2; k++) if (ajouterJours(t, k) === d) return ' <span class="etiquette ' + m[k][1] + ' jour-du-jour">' + m[k][0] + '</span>';
    return '';
  }
  function libelleJour(d) { return d === aujourdhui() ? 'Aujourd\'hui' : majuscule(dateLongue(d)); }

  // Aujourd'hui : les visites du jour, dans l'ordre, avec contact, itinéraire et compte rendu
  // Jour affiché : celui de la tournée (S.ui.jour) ou, hors tournée, une date choisie avec ‹ › ou le calendrier (S.ui.jourVue)
  function jourAffiche() {
    var dates = datesPlan();
    if (S.ui.jourVue && dates.indexOf(S.ui.jourVue) >= 0) { S.ui.jour = S.ui.jourVue; S.ui.jourVue = null; }
    if (S.ui.jourVue) return S.ui.jourVue;
    if (!dates.length) return aujourdhui();
    choisirJour(dates); return S.ui.jour;
  }
  function allerAuJour(d) {
    if (datesPlan().indexOf(d) >= 0) { S.ui.jour = d; S.ui.jourVue = null; } else S.ui.jourVue = d;
    S.ui.ouvert = null; rendre(); window.scrollTo(0, 0);
  }
  // En-tête du jour : « Aujourd'hui », la date affichée, l'état de la tournée, une seule navigation (bande de la semaine)
  function nbVisitesJour(d) { var n = S.plan.filter(function (a) { return a.date === d; }).length; return n || programmeDuJour(d).length; }
  function enteteJour(d) {
    var t = aujourdhui(), dates = datesPlan(), tour = dates.indexOf(d) >= 0, etat;
    if (tour) etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmée</span>' :
      '<button type="button" class="etiquette alerte bouton-etiquette" data-a="nav" data-tab="semaine">Brouillon › Planifier</button>';
    else etat = d < t ? '<span class="etiquette">' + (passeVerrouille(d) ? 'Lecture seule' : 'Jour passé') + '</span>' : (d > t ? '<span class="etiquette p1">' + (futurVerrouille(d) ? 'Aperçu' : 'Jour à venir') + '</span>' : '');
    // 3.19.0 : bande défilante des jours ouvrés (glisser à gauche ou à droite), jour choisi au centre, en couleur
    var jours = []; for (var k = -42; k <= 42; k++) { var x0 = ajouterJours(d, k); if (jourSemaineIndex(x0) < 5) jours.push(x0); }
    return '<div class="tete-jour"><div><h2 class="titre-vue">Journée' + etiquetteRelative(d) + '</h2>' +
        '<p class="date-jour">' + majuscule(dateLongue(d)) + (d !== t ? ' · <button type="button" class="bouton-texte" data-a="jourAujourdhui">Revenir à aujourd\'hui</button>' : '') + '</p></div>' + etat + '</div>' +
      '<p class="sous-titre">Vos visites dans l\'ordre : itinéraire, contact et compte rendu.</p>' +
      '<div class="bande-jours">' +
        '<div class="bj-jours" role="group" aria-label="Jours">' + jours.map(function (x) {
          var n = nbVisitesJour(x);
          return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (jourSemaineIndex(x) === 0 ? ' lundi' : '') + '" data-a="jourAller" data-v="' + x + '" aria-pressed="' + (x === d) + '"><small>' +
            JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em><i>' + (n ? n : '') + '</i></button>';
        }).join('') + '</div>' +
        '<label class="bj-cal" aria-label="Choisir une date">' + icone('calendrier') + '<input type="date" data-f="jourDate" value="' + esc(d) + '"></label></div>';
  }
  // programme d'un jour hors tournée en cours : archive du téléphone, sinon tournée publiée (feuille Plannings)
  function programmeDuJour(d) {
    var arch = LS.get('archives', {});
    if (arch[d] && arch[d].length) return arch[d];
    return ((S.data && S.data.plannings) || []).filter(function (x) { return x.date === d && x.delegue && estMoi(x.delegue); });
  }
  // visite prévue un jour hors de la tournée en cours (passé ou aujourd'hui) : carte avec compte rendu, gardée à part
  S.horsPlan = LS.get('horsPlan', []).filter(function (a) { return a.date >= ajouterJours(aujourdhui(), -70); });
  // créneau de présence d'un praticien un jour donné (pour retrouver heure, début et fin d'une visite passée)
  function creneauDe(code, d, idPresence, creneau) {
    var l = (ctx().parCode[code] || []).filter(function (c) { return c.jourIdx === jourSemaineIndex(d); });
    return l.filter(function (c) { return idPresence && String(c.idPresence) === String(idPresence); })[0] ||
      l.filter(function (c) { return creneau && c.creneau === creneau; })[0] || l[0] || null;
  }
  function completerHeures(a) {
    if (a.heure && a.debut) return a;
    var c = creneauDe(a.code, a.date, a.idPresence, a.creneau);
    if (c) {
      if (!a.heure) a.heure = minutesVersHeure(c.debut);
      if (!a.debut) a.debut = minutesVersHeure(c.debut);
      if (!a.fin) a.fin = minutesVersHeure(c.fin);
      if (!a.creneau) a.creneau = c.creneau;
      if (!a.lieu) a.lieu = c.lieu; if (!a.quartier) a.quartier = c.quartier;
    }
    return a;
  }
  function arretHors(x, d) {
    var uid = 'H-' + d + '-' + x.code, a = S.horsPlan.filter(function (y) { return y.uid === uid; })[0];
    if (a) return completerHeures(a);
    var pr = praticien(x.code) || {}, cr = x.idPresence && ctx().parCode[x.code] ? ctx().parCode[x.code].filter(function (c) { return String(c.idPresence) === String(x.idPresence); })[0] : null;
    a = { uid: uid, hors: true, date: d, heure: x.heure || '', creneau: x.creneau || (cr ? cr.creneau : ''), debut: x.debut || (cr ? minutesVersHeure(cr.debut) : ''), fin: x.fin || (cr ? minutesVersHeure(cr.fin) : ''),
      idPresence: x.idPresence || '', code: x.code, nom: x.nom || pr.nom || x.code, type: pr.type || x.type || 'Médecin', specialite: x.specialite || pr.specialite || '',
      note: x.note || pr.note, conventionne: pr.conventionne, quartier: x.quartier || '', commune: x.commune || '', lieu: x.lieu || '', lat: cr && cr.coord ? cr.coord.lat : '', lon: cr && cr.coord ? cr.coord.lon : '', etat: 'propose' };
    S.horsPlan.push(a); return completerHeures(a);
  }
  // visite déjà renseignée un jour hors tournée : carte « compte rendu enregistré », modifiable (même identifiant que dans l'Historique)
  function arretDeVisite(v, x, d) {
    var uid = v.uid || ('V-' + d + '-' + v.code), a = S.horsPlan.filter(function (y) { return y.uid === uid; })[0];
    if (a) return completerHeures(a);
    var pr = praticien(v.code) || {}; x = x || {};
    a = { uid: uid, hors: true, date: d, heure: v.heure || x.heure || '', creneau: v.creneau || x.creneau || '', debut: x.debut || '', fin: x.fin || '', idPresence: v.idPresence || x.idPresence || '',
      code: v.code, nom: v.nom || x.nom || pr.nom || v.code, type: v.type || pr.type || 'Médecin', specialite: v.specialite || x.specialite || pr.specialite || '', note: v.note || x.note || pr.note,
      conventionne: pr.conventionne, quartier: v.quartier || x.quartier || '', commune: v.commune || x.commune || '', lieu: v.lieu || x.lieu || '',
      statut: v.statut || '', activite: v.activite || '', produits: v.produits || '', commentaire: v.commentaire || '', prochaine: String(v.prochaine || '').slice(0, 10), etat: 'valide' };
    S.horsPlan.push(a); return completerHeures(a);
  }
  // toutes les visites d'un jour hors tournée : prévues (archive ou tournée publiée) et réalisées (Historique)
  function arretsHorsJour(d) {
    var prevus = programmeDuJour(d), faites = visitesConnues().filter(function (v) { return String(v.date || '').slice(0, 10) === d && (!v.delegue || estMoi(v.delegue)); });
    var parCode = {}; faites.forEach(function (v) { parCode[v.code] = v; });
    var l = prevus.map(function (x) { return parCode[x.code] ? arretDeVisite(parCode[x.code], x, d) : arretHors(x, d); });
    faites.forEach(function (v) { if (!prevus.some(function (x) { return x.code === v.code; })) { var a = arretDeVisite(v, null, d); a.horsTournee = true; l.push(a); } });
    return l.sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
  }
  // 3.22.1 : en bas de Journée, de quoi remplacer au pied levé un praticien qui n'est plus disponible :
  // + Médecin, + Pharmacie (présents près de moi), Autour de moi (par ma position ou dans les communes du jour)
  function blocRemplacant(d) {
    if (d < aujourdhui() || jourSemaineIndex(d) > 4) return '';
    return '<section class="bloc-remplacant"><p class="discret">Praticien indisponible ? Trouver un remplaçant :</p>' +
      '<div class="rangee-3"><button class="bouton" type="button" data-a="ajouterProches" data-v="Médecin" data-d="' + d + '">' + icone('plus') + 'Médecin</button>' +
      '<button class="bouton" type="button" data-a="ajouterProches" data-v="Pharmacie" data-d="' + d + '">' + icone('plus') + 'Pharmacie</button>' +
      '<button class="bouton" type="button" data-a="ajouterTournee" data-d="' + d + '">' + icone('cible') + 'Autour de moi</button></div>' +
      '<button class="bouton-texte" type="button" data-a="nav" data-tab="semaine">' + icone('calendrier') + 'Modifier la tournée</button></section>';
  }
  // jour sans visite (aujourd'hui ou à venir, jour ouvré) : planifier directement cette journée
  function boutonPlanifierJour(d) {
    if (d < aujourdhui()) return '';
    // week-end ou férié : on propose le prochain jour ouvré
    var n = 0; while ((jourSemaineIndex(d) > 4 || estFerie(d)) && n++ < 10) d = ajouterJours(d, 1);
    return '<button class="bouton bouton-plein bouton-large" type="button" data-a="planifierDate" data-v="' + d + '" style="margin-top:12px">' + icone('calendrier') + 'Planifier le ' + esc(dateCourte(d)) + '</button>';
  }
  // 3.24.7 : compteurs du jour : visites, faites, sans CR (ouvre le compte rendu), à planifier
  // (visites par jour voulues dans Planifier moins celles déjà prévues ; ouvre Planifier pour ce jour)
  function compteursJour(d, l) {
    var t = aujourdhui(), n = l.length, nf = l.filter(function (a) { return a.statut && !estKo(a.statut); }).length;
    var sans = d <= t || !futurVerrouille(d) ? l.filter(function (a) { return !a.statut; }).length : 0;
    var aPlan = d >= t && jourSemaineIndex(d) < 5 && !estFerie(d) ? Math.max(0, (+S.params.maxJour || 8) - n) : 0;
    return '<b>' + n + ' visite' + (n > 1 ? 's' : '') + '</b> · ' + nf + ' faite' + (nf > 1 ? 's' : '') +
      (sans ? ' · <button type="button" class="bouton-texte lien-cr" data-a="ouvrirRapport">' + sans + ' sans CR ›</button>' : '') +
      (aPlan ? ' · <button type="button" class="bouton-texte lien-cr lien-plan" data-a="planifierDate" data-v="' + d + '">' + aPlan + ' à planifier ›</button>' : '');
  }
  function rendreJourHors(d) {
    var t = aujourdhui(), h = '';
    if (!futurVerrouille(d)) {
      // jour passé (ou à venir si la saisie anticipée est activée) : tout reste modifiable, comme dans la tournée (compte rendu à saisir ou à corriger)
      var l = arretsHorsJour(d);
      if (!l.length) return '<div class="vide"><strong>Aucune visite ce jour-là</strong>Ni tournée archivée ni compte rendu pour cette date.</div>' + boutonPlanifierJour(d);
      var nf = l.filter(function (a) { return a.statut && !estKo(a.statut); }).length;
      h += '<section class="synthese-jour"><div class="sj-ligne"><span>' + compteursJour(d, l) + '</span></div>' +
        barreRealise(nf, l.length, l.filter(function (a) { return a.statut; }).length) +
        '<small class="discret">' + (passeVerrouille(d) ? 'Consultation seule (« Saisie avancée » désactivée dans Réglages › Avancé).' : (d > t ? 'Saisie anticipée activée : touchez une visite pour saisir son compte rendu.' : 'Touchez une visite pour saisir ou modifier son compte rendu.')) + '</small></section>';
      h += '<ol class="ligne">' + l.map(rendreArret).join('') + '</ol>';
      if (l.length) h += blocRemplacant(d);
      if (programmeDuJour(d).length) h += '<div class="rangee-actions pied-jour"><button class="bouton petit" type="button" data-a="ouvrirAnciens">' + icone('relancer') + 'Reprendre ce programme un autre jour</button></div>';
      return h;
    }
    // jour à venir hors tournée : aperçu de la tournée publiée
    var prevus = programmeDuJour(d).slice().sort(function (a, b) { return String(a.heure || '').localeCompare(String(b.heure || '')); });
    if (!prevus.length) return '<div class="vide"><strong>Rien de prévu ce jour-là</strong>Aucune tournée publiée pour cette date.</div>' + boutonPlanifierJour(d);
    h += '<p class="bilan-jour"><b>' + prevus.length + ' visite' + (prevus.length > 1 ? 's' : '') + ' prévue' + (prevus.length > 1 ? 's' : '') + '</b>.</p>';
    h += '<ul class="liste">' + prevus.map(function (x) {
      return '<li class="element' + classeType(x) + '"><div class="element-tete"><div><b>' + esc(x.heure || '--:--') + '</b> · ' + pastilleType(x) + '<b>' + esc(x.nom || '') + '</b> ' + etoiles(x.note) +
        '<span class="discret bloc-texte">' + esc([x.specialite, x.lieu, x.quartier].filter(Boolean).join(', ')) + '</span></div></div></li>';
    }).join('') + '</ul>';
    return h + '<button class="bouton bouton-plein bouton-large" type="button" data-a="jourReprendre" data-v="' + d + '">' + icone('relancer') + 'Reprendre ce programme</button>';
  }

  // ------------------------------------------------------------------ Aujourd'hui : écran de terrain + compte rendu de la journée
  // 1. en-tête (date, état, semaine) 2. synthèse et progression 3. « Maintenant » (selon l'heure) 4. parcours du jour
  // 5. ajouter / modifier 6. compte rendu de la journée (rempli à partir des visites, complété par le délégué)
  VUES.jour = function () {
    var d = jourAffiche(), t = aujourdhui(), h = enteteJour(d);
    if (S.ui.jourVue) {
      h += d === t ? rendreRappels() : '';
      if (!futurVerrouille(d)) { var lh = arretsHorsJour(d); if (lh.length && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, lh); }
      h += rendreJourHors(d);
      return h;
    }
    if (!S.plan.length) {
      return h + rendreRappels() + '<div class="vide"><strong>Aucune visite prévue</strong>Préparez d\'abord votre tournée dans « Planifier ».</div>' +
        (boutonPlanifierJour(d) || '<button class="bouton bouton-plein bouton-large" type="button" data-a="nav" data-tab="semaine" style="margin-top:12px">' + icone('calendrier') + 'Planifier ma tournée</button>');
    }
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var renseignees = duJour.filter(function (a) { return a.statut; }).length;
    var com = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var est = estimationJour(duJour), liens = lienItineraire(duJour);
    var infos = [est ? minutesVersHeure(est.debut) + ' → ' + minutesVersHeure(est.fin) : '', com.length ? esc(libelleCommunes(com)) : ''].filter(Boolean).join(' · ');
    h += '<section class="synthese-jour"><div class="sj-ligne"><span>' + compteursJour(d, duJour) + (infos ? '<small class="discret bloc-texte">' + infos + '</small>' : '') + '</span>' +
        (liens.length ? '<a class="bouton petit" href="' + esc(liens[0]) + '" target="_blank" rel="noopener">' + icone('route') + 'Itinéraire</a>' : '') + '</div>' +
      barreRealise(duJour.filter(function (a) { return a.statut && !estKo(a.statut); }).length, duJour.length, duJour.filter(function (a) { return a.statut; }).length) +
      '</section>';
    if (!futurVerrouille(d) && (rapportDe(d) || !passeVerrouille(d))) h += tuileRapport(d, duJour);
    if (d === t) h += rendreRappels() + rendreMaintenant(duJour, liens);
    // 3.24.23 : les visites renseignées passent en bas (« Effectuées », dans l'ordre des heures) ;
    // en haut restent les visites à faire, les plus proches d'abord
    var hv = function (x) { return heureVersMinutes((x.statut && x.valideA) || x.heure) || 0; };
    var parHeure = function (x, y) { return hv(x) - hv(y); };
    var aFaire = duJour.filter(function (a) { return !a.statut; }), faites = duJour.filter(function (a) { return a.statut; }).sort(parHeure);
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = aFaire.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0) {
          h += '<li class="troncon"><div></div><div class="arret-rail"></div>' +
            trajetMini(a.dist, a.trajet !== undefined ? a.trajet : Math.round(a.dist * REGLAGES_MOTEUR.minutesParKm)) + '</li>';
        }
        h += rendreArret(a);
      });
      h += '</ol>';
    });
    // fin de journée (tout est renseigné) : le parcours réel, dans l'ordre des heures de validation
    if (faites.length) h += '<div class="creneau-titre">' + (aFaire.length ? 'Effectuées · ' + faites.length : 'Parcours de la journée · ' + faites.length + ' visite' + (faites.length > 1 ? 's' : '')) + '</div><ol class="ligne faites">' + faites.map(rendreArret).join('') + '</ol>';
    h += blocRemplacant(d);
    return h;
  };
  // accès au compte rendu (page à part, dans le même onglet)
  function tuileRapport(d, liste) {
    var R = rapportDe(d), n = liste.length, r = liste.filter(function (a) { return a.statut; }).length;
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    return '<button type="button" class="acces-rapport" data-a="ouvrirRapport"><span>' + icone('crayon') + '<b>Compte Rendu</b><small>' + r + '/' + n + ' visite' + (n > 1 ? 's' : '') + ' renseignée' + (r > 1 ? 's' : '') +
      ' · faits marquants, concurrence, besoins</small></span>' + etat + icone('chevron') + '</button>';
  }
  VUES.rapport = function () {
    var d = jourAffiche(), t = aujourdhui();
    var liste = S.ui.jourVue ? arretsHorsJour(d) : S.plan.filter(function (a) { return a.date === d; });
    return '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">Compte Rendu</h2><p class="sous-titre">' + majuscule(dateLongue(d)) + ' : rempli à partir de vos visites, à compléter puis à valider.</p>' +
      (futurVerrouille(d) ? '<div class="vide"><strong>Journée à venir</strong>Le compte rendu se fait le jour même ou après (ou activez « Saisie avancée » dans Réglages › Avancé).</div>' : rendreRapportJour(d, liste, passeVerrouille(d), true));
  };

  // « Maintenant » : ce qu'il y a à faire tout de suite, selon l'heure
  function rendreMaintenant(duJour, liens) {
    var now = minutesMaintenant(), sans = duJour.filter(function (a) { return !a.statut; });
    var aSaisir = sans.filter(function (a) { return heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) < now; });
    var suivante = sans.filter(function (a) { return heureVersMinutes(a.heure) === null || heureVersMinutes(a.heure) >= now; })[0];
    var h = '<section class="maintenant"><h3>Maintenant</h3>';
    suivrePosition();
    var proche = visiteProche(sans, suivante);
    if (proche) {
      h += '<div class="bandeau-proche' + classeType(proche.a) + '">' + pastilleType(proche.a, true) + '<p>Vous êtes à <b>' + metres(proche.d) + '</b> de <b>' + esc(nomSansType(proche.a.nom)) + '</b> (prévu à ' + esc(proche.a.heure) + '). Le voir maintenant ?</p>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="procheNon" data-uid="' + proche.a.uid + '">Non</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="procheOui" data-uid="' + proche.a.uid + '">Maintenant</button></div></div>';
    } else {
      var ph = pharmacieProche(duJour);
      if (ph) {
        h += '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
          ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
          '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
      }
    }
    if (!sans.length) {
      return h + '<p>Toutes les visites sont renseignées. Finalisez le compte rendu.</p>' +
        '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div></section>';
    }
    if (aSaisir.length) {
      h += '<div class="a-saisir"><b>' + icone('crayon') + aSaisir.length + ' compte' + (aSaisir.length > 1 ? 's' : '') + ' rendu' + (aSaisir.length > 1 ? 's' : '') + ' à saisir</b>' +
        aSaisir.slice(0, 3).map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.heure) + ' ' + esc(a.nom) + '</button>'; }).join('') + '</div>';
    }
    if (suivante) {
      var pa = praticien(suivante.code) || {}, premiere = suivante === duJour[0] && !duJour.some(function (a) { return a.statut; });
      var cS = coordPrecise(suivante) || coordArret(suivante), pos = S.ui.posGps && Date.now() - S.ui.posGps.t < 5 * 60000 ? S.ui.posGps : null, tr = '';
      if (cS && pos) {
        var qp = Moteur.quartierLePlusProche(pos.lat, pos.lon, quartiers()), dk = distanceVol(pos, cS);
        tr = trajetMini(dk, minutesTrajet(dk, qp ? qp.quartier.commune : '', suivante.commune, now));
      } else if (suivante.dist > 0) tr = trajetMini(suivante.dist, suivante.trajet !== undefined ? suivante.trajet : Math.round(suivante.dist * REGLAGES_MOTEUR.minutesParKm));
      h += '<div class="suivante"><small>' + (premiere ? 'Première visite' : 'Visite suivante') + '</small><b>' + esc(suivante.heure) + ' · ' + pastilleType(suivante) + esc(suivante.nom) + '</b> ' + etoiles(suivante.note) +
        (lieuQuartier(suivante) ? '<span class="discret bloc-texte">' + esc(lieuQuartier(suivante)) + '</span>' : '') + tr +
        actionsRapides({ telephone: pa.telephone, lat: suivante.lat, lon: suivante.lon, lieu: suivante.lieu, quartier: suivante.quartier, commune: suivante.commune }) +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="ouvrirVisite" data-uid="' + suivante.uid + '">' + icone('crayon') + 'Compte Rendu de cette visite</button></div>';
    }
    return h + '</section>';
  }

  // 3.23.0 : position suivie toutes les 2 minutes pendant que Journée montre aujourd'hui ;
  // une visite prévue plus tard, à moins de 500 m et dont le praticien est présent à cette heure, est proposée « maintenant »
  var RAYON_PROCHE_KM = 0.5, MARGE_PRESENCE_MIN = 10;   // 3.24.20 : 500 m, au moins 10 min de présence restantes
  function suivrePosition() {
    if (S.ui.gpsMinuteur || !navigator.geolocation) return;
    var lire = function () {
      if (S.ui.tab !== 'jour' || jourAffiche() !== aujourdhui() || document.hidden) return;
      navigator.geolocation.getCurrentPosition(function (p) {
        var avant = S.ui.posGps;
        S.ui.posGps = { lat: p.coords.latitude, lon: p.coords.longitude, t: Date.now() };
        if (!avant || distanceKm(avant, S.ui.posGps) > 0.05) rendreSiPossible();
      }, function () {}, { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 });
    };
    S.ui.gpsMinuteur = setInterval(lire, 120000);
    setTimeout(lire, 500);
  }
  function coordPrecise(a) {
    if (a.lat && a.lon) return { lat: +a.lat, lon: +a.lon };
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    return cr && cr.coord ? cr.coord : null;
  }
  // pharmacie ouverte à moins de 500 m, hors de ma journée, non prévue par un collègue cette semaine, pas vue récemment
  var RAYON_PHARMACIE_KM = 0.5;
  function pharmacieProche(duJour) {
    var pos = S.ui.posGps, t = aujourdhui(); if (!pos || Date.now() - pos.t > 5 * 60000 || jourSemaineIndex(t) > 4) return null;
    var now = minutesMaintenant(), refus = LS.get('refusPharmacies', {}), dans = ensemble(duJour.map(function (a) { return a.code; })), ex = exclusCollegues([t]), best = null;
    if (refus.d !== t) refus = { codes: {} };
    (ctx().parJour[jourSemaineIndex(t)] || []).forEach(function (c) {
      var p = c.prat;
      if (!p || p.type !== 'Pharmacie' || !c.coord || dans[c.code] || ex[c.code] || refus.codes[c.code] || absentLe(p, t)) return;
      if (now < c.debut || now > c.fin - 10) return;
      if (p.derniere && joursEcoules(p.derniere, t) < (+S.params.delai || 7)) return;
      var d = distanceVol(pos, c.coord);
      if (d <= RAYON_PHARMACIE_KM && (!best || d < best.d)) best = { c: c, d: d };
    });
    return best;
  }
  function visiteProche(sans, suivante) {
    var pos = S.ui.posGps; if (!pos || Date.now() - pos.t > 5 * 60000) return null;
    var now = minutesMaintenant(), refus = LS.get('refusProches', {}), best = null;
    sans.forEach(function (a) {
      if (a === suivante || (refus.d === aujourdhui() && refus.uids && refus.uids[a.uid])) return;
      var c = coordPrecise(a), deb = heureVersMinutes(a.debut), fin = heureVersMinutes(a.fin);
      if (!c || deb === null || fin === null || now < deb || now > fin - MARGE_PRESENCE_MIN) return;
      if (heureVersMinutes(a.heure) !== null && heureVersMinutes(a.heure) <= now + 15) return;   // déjà imminente
      var d = distanceVol(pos, c);
      if (d <= RAYON_PROCHE_KM && (!best || d < best.d)) best = { a: a, d: d };
    });
    return best;
  }
  // ------------------------------------------------------------------ Compte Rendu de la journée
  S.rapports = LS.get('rapports', {});
  function rapportDe(d) {
    if (S.rapports[d]) return S.rapports[d];
    var srv = ((S.data && S.data.rapports) || []).filter(function (r) { return r.date === d && estMoi(r.delegue); })[0];
    if (srv) { S.rapports[d] = { faits: srv.faits || '', concurrence: srv.concurrence || '', besoins: [], besoinsTexte: srv.besoins || '', km: srv.km || '', valideLe: srv.valideLe || '', envoye: true, ok: { faits: 1, concurrence: 1, besoins: 1, km: 1 } }; return S.rapports[d]; }
    return null;
  }
  function rapportOuCree(d) { return rapportDe(d) || (S.rapports[d] = { faits: '', concurrence: '', besoins: [], besoinsTexte: '', km: '', ok: {} }); }
  function sauverRapports() { LS.set('rapports', S.rapports); }
  var BESOINS_JOUR = ['Supports promotionnels', 'Échantillons', 'Appui du responsable', 'Formation', 'Autre'];
  // synthèse automatique à partir des comptes rendus de visite de la journée
  function syntheseJour(duJour) {
    var s = { prevues: duJour.length, faites: [], nonFaites: [], sansCr: [], pot: { 3: 0, 2: 0, 1: 0 }, produits: {}, echantillons: [], commandes: [], ruptures: [], suites: [], km: 0, communes: [] };
    duJour.forEach(function (a) {
      s.km += a.dist || 0;
      if (a.commune && s.communes.indexOf(a.commune) < 0) s.communes.push(a.commune);
      if (!a.statut) { s.sansCr.push(a); return; }
      if (estKo(a.statut)) { s.nonFaites.push(a); return; }
      s.faites.push(a); s.pot[+a.note || 1] = (s.pot[+a.note || 1] || 0) + 1;
      var r = a.cr ? champsCr(a) : { produits: a.produits || '' };
      if (!estPharmacie(a)) listeProduits(r.produits || '').forEach(function (x) { s.produits[x] = (s.produits[x] || 0) + 1; });
      if (r.echantillons) s.echantillons.push(a.nom + ' : ' + r.echantillons);
      if (r.commande) s.commandes.push(a.nom + ' : ' + r.commande);
      var st = (a.cr && crDe(a).stocks) || {};
      Object.keys(st).forEach(function (x) { if (st[x] && st[x].etat === 'Rupture') s.ruptures.push(x + ' (' + a.nom + ')'); });
      if (a.prochaine && a.prochaine > a.date) s.suites.push(a.nom + ' : ' + (a.rdvConfirme ? 'RDV' : 'rappel') + ' le ' + dateFr(a.prochaine));
    });
    s.est = estimationJour(duJour);
    return s;
  }
  function lignesSynthese(s) {
    var prod = Object.keys(s.produits).sort(function (a, b) { return s.produits[b] - s.produits[a]; }).map(function (x) { return x + (s.produits[x] > 1 ? ' (' + s.produits[x] + ')' : ''); });
    var l = [['Visites', s.faites.length + ' faite' + (s.faites.length > 1 ? 's' : '') + ' sur ' + s.prevues + (s.sansCr.length ? ' · ' + s.sansCr.length + ' sans compte rendu' : '')]];
    if (s.faites.length) l.push(['Potentiel vu', [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join(' · ')]);
    if (s.nonFaites.length) l.push(['Non faites', s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a).toLowerCase() + ')'; }).join(', ')]);
    if (prod.length) l.push(['Produits présentés', prod.join(', ')]);
    if (s.echantillons.length) l.push(['Échantillons', s.echantillons.join(' ; ')]);
    if (s.commandes.length) l.push(['Commandes', s.commandes.join(' ; ')]);
    if (s.ruptures.length) l.push(['Ruptures', s.ruptures.join(', ')]);
    if (s.suites.length) l.push(['RDV et rappels', s.suites.join(' ; ')]);
    l.push(['Trajet', km(s.km) + (s.est ? ', ' + minutesVersHeure(s.est.debut) + ' à ' + minutesVersHeure(s.est.fin) : '') + (s.communes.length ? ', ' + s.communes.join(', ') : '')]);
    return l;
  }
  function etapesRapport(R, s) {
    var resumeTxt = function (v, vide) { return String(v || '').trim() || vide; };
    return [
      { id: 'faits', titre: 'Faits marquants', resume: function () { return resumeTxt(R.faits, 'Rien à signaler'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="faits" placeholder="Ex. le Dr X demande une étude sur Rozukaa ; nouvelle pharmacie ouverte à Angré">' + esc(R.faits || '') + '</textarea>'; } },
      { id: 'concurrence', titre: 'Concurrence observée', resume: function () { return resumeTxt(R.concurrence, 'Rien observé'); },
        rendu: function () { return '<textarea data-f="rapport" data-k="concurrence" placeholder="Produit, prix, action du concurrent…">' + esc(R.concurrence || '') + '</textarea>'; } },
      { id: 'besoins', titre: 'Besoins', resume: function () { var b = (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []); return b.length ? b.join(', ') : 'Aucun'; },
        rendu: function () {
          return '<div class="puces">' + BESOINS_JOUR.map(function (x) { return '<button type="button" class="puce" data-a="rapBesoin" data-v="' + esc(x) + '" aria-pressed="' + ((R.besoins || []).indexOf(x) >= 0) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
            '<textarea data-f="rapport" data-k="besoinsTexte" placeholder="Précisez si besoin" style="margin-top:8px">' + esc(R.besoinsTexte || '') + '</textarea>';
        } },
      { id: 'km', titre: 'Kilomètres parcourus', resume: function () { return R.km ? R.km + ' km' : 'Estimation : ' + km(s.km); },
        rendu: function () { return '<label class="champ" style="margin:8px 0 0"><span>Kilomètres réels (vide : estimation de ' + km(s.km) + ')</span><input type="number" min="0" inputmode="numeric" data-f="rapport" data-k="km" value="' + esc(R.km || '') + '"></label>'; } }
    ];
  }
  function rendreRapportJour(d, duJour, lecture, page) {
    var R = lecture ? rapportDe(d) : rapportOuCree(d), s = syntheseJour(duJour.length ? duJour : []);
    var etat = R && R.valideLe ? '<span class="etiquette ok">Validé le ' + esc(R.valideLe) + '</span>' : (R && Object.keys(R.ok || {}).length ? '<span class="etiquette p1">En cours</span>' : '<span class="etiquette">À faire</span>');
    var h = '<section class="bloc rapport-jour" id="rapportJour"><div class="tete-bloc"><h3>' + (page ? 'Synthèse de la journée' : 'Compte Rendu') + '</h3>' + etat + '</div>';
    if (duJour.length) h += '<div class="tuiles-resume">' + lignesSynthese(s).map(function (x) {
      return '<div class="tuile statique' + (String(x[1]).length > 38 ? ' large' : '') + '"><small>' + esc(x[0]) + '</small><b>' + parLigne(x[1]) + '</b></div>';
    }).join('') + '</div>';
    // 3.24.16 : dans la page Compte Rendu, un bouton pour envoyer le CR de la journée au superviseur (numéro des Réglages)
    var waSup = page ? '<div class="rangee-wa"><button class="bouton wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + (S.config.waResp ? 'Envoyer au superviseur' : 'Envoyer par WhatsApp') + '</button></div>' +
      (S.config.waResp ? '' : '<p class="discret" style="text-align:center;margin-top:-6px">Numéro du superviseur : Réglages (roue crantée).</p>') : '';
    if (!R) return h + '<p class="discret">Pas de compte rendu de journée enregistré.</p>' + waSup + '</section>';
    var etapes = etapesRapport(R, s), ok = R.ok || (R.ok = {}), edition = !lecture && (!R.valideLe || R.edition);
    var enCours = edition ? etapes.filter(function (e) { return !ok[e.id]; })[0] : null;
    h += '<div class="cr-pas etapes-filtres" style="margin-top:12px">';
    etapes.forEach(function (e, i) {
      if (!enCours || ok[e.id]) {
        h += edition ? '<button type="button" class="cr-fait" data-a="rapEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>'
          : '<div class="cr-fait"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b></div>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + etapes.length + ', facultatif</small></span>' + e.rendu() +
        boutonsEtape(i > 0 ? 'rapPrec' : '', i > 0 ? etapes[i - 1].id : '', 'rapPasser', 'rapOk', e.id, i === etapes.length - 1) + '</div>';
    });
    h += '</div>';
    if (lecture) return h + waSup + '</section>';
    if (edition && !enCours) {
      if (s.sansCr.length) h += '<div class="bandeau"><p><b>' + s.sansCr.length + ' visite' + (s.sansCr.length > 1 ? 's' : '') + ' sans compte rendu :</b> ' +
        s.sansCr.map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.nom) + '</button>'; }).join(', ') +
        '. Complétez-les, ou validez la journée telle quelle.</p></div>';
      h += '<button class="bouton bouton-plein bouton-large" type="button" data-a="rapValider" data-v="' + d + '">' + icone('valider') + 'Valider le compte rendu</button>';
    } else if (!edition) {
      h += '<div class="rangee-actions" style="margin-top:10px">' + (page ? '' : '<button class="bouton petit wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + 'Envoyer</button>') +
        '<button class="bouton petit" type="button" data-a="rapCopier" data-v="' + d + '">Copier</button>' +
        '<button class="bouton petit" type="button" data-a="rapModifier" data-v="' + d + '">' + icone('crayon') + 'Modifier</button></div>';
    }
    return h + (page ? '<div style="margin-top:12px">' + waSup + '</div>' : '') + '</section>';
  }
  function visitesDuJourRapport(d) { var l = S.plan.filter(function (a) { return a.date === d; }); return l.length ? l : arretsHorsJour(d); }
  // 3.25.4 : mise en forme WhatsApp (*gras*, _italique_, puces •, une ligne vide entre les sections)
  function sectionWa(titre, items, vide) {
    var l = (items || []).filter(function (x) { return String(x || '').trim(); });
    if (!l.length && vide === undefined) return [];
    return ['', '*' + titre + '*' + (l.length > 1 ? ' (' + l.length + ')' : '')].concat(l.length ? l.map(function (x) { return '• ' + x; }) : ['_' + vide + '_']);
  }
  function heureVisite(a) { return (a.statut && a.valideA) || a.heure || ''; }
  function texteRapport(d) {
    var R = rapportDe(d) || {}, duJour = visitesDuJourRapport(d), s = syntheseJour(duJour);
    var pot = [[3, '★★★'], [2, '★★'], [1, '★']].filter(function (x) { return s.pot[x[0]]; }).map(function (x) { return s.pot[x[0]] + ' ' + x[1]; }).join('  ·  ');
    var prod = Object.keys(s.produits).sort(function (a, b) { return s.produits[b] - s.produits[a]; }).map(function (x) { return x + (s.produits[x] > 1 ? ' _(' + s.produits[x] + ')_' : ''); });
    var faites = s.faites.slice().sort(function (a, b) { return String(heureVisite(a)).localeCompare(String(heureVisite(b))); });
    var l = ['*COMPTE RENDU DU ' + dateLongue(d).toUpperCase() + '*', '_' + (moi() || 'Délégué') + '_', '',
      '*Bilan de la journée*',
      '• Visites : *' + s.faites.length + ' faite' + (s.faites.length > 1 ? 's' : '') + ' sur ' + s.prevues + '*' + (s.sansCr.length ? ' _(' + s.sansCr.length + ' sans compte rendu)_' : '')];
    if (pot) l.push('• Potentiel vu : ' + pot);
    l.push('• Trajet : ' + (R.km ? R.km + ' km (réels)' : km(s.km)) + (s.est ? ', de ' + minutesVersHeure(s.est.debut) + ' à ' + minutesVersHeure(s.est.fin) : ''));
    if (s.communes.length) l.push('• Communes : ' + s.communes.join(', '));
    l = l.concat(sectionWa('Visites faites', faites.map(function (a) { var h = heureVisite(a); return (h ? h + '  ' : '') + '*' + a.nom + '*' + (a.lieu ? ', ' + a.lieu : ''); })));
    l = l.concat(sectionWa('Visites non faites', s.nonFaites.map(function (a) { return a.nom + ' : ' + String(statutLibelle(a) || '').toLowerCase(); })));
    l = l.concat(sectionWa('Produits présentés', prod));
    l = l.concat(sectionWa('Échantillons remis', s.echantillons));
    l = l.concat(sectionWa('Commandes', s.commandes));
    l = l.concat(sectionWa('Ruptures signalées', s.ruptures));
    l = l.concat(sectionWa('RDV et rappels', s.suites));
    l = l.concat(sectionWa('Faits marquants', String(R.faits || '').split(/\n+/), 'Rien à signaler'));
    l = l.concat(sectionWa('Concurrence', String(R.concurrence || '').split(/\n+/), 'Rien observé'));
    l = l.concat(sectionWa('Besoins', (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []), 'Aucun'));
    return l.join('\n');
  }
  function empreinteRapport(R) { return JSON.stringify([R.faits || '', R.concurrence || '', R.besoins || [], R.besoinsTexte || '', R.km || '']); }
  function envoyerRapport(d) {
    var R = rapportDe(d); if (!R || !R.valideLe || !connecte() || !moi()) return Promise.resolve();
    var s = syntheseJour(visitesDuJourRapport(d));
    var payload = { delegue: moi(), date: d, valideLe: R.valideLe, prevues: s.prevues, faites: s.faites.length,
      nonFaites: s.nonFaites.map(function (a) { return a.nom + ' (' + statutLibelle(a) + ')'; }).join(', '), sansCr: s.sansCr.length,
      synthese: lignesSynthese(s).map(function (x) { return x[0] + ' : ' + x[1]; }).join('\n'), faits: R.faits || '', concurrence: R.concurrence || '',
      besoins: (R.besoins || []).concat(R.besoinsTexte ? [R.besoinsTexte] : []).join(', '), km: R.km || (Math.round(s.km * 10) / 10) };
    return apiPost('rapport', { rapport: payload }).then(function () { R.envoye = true; sauverRapports(); });
  }
  function envoyerRapportsEnAttente() {
    var l = Object.keys(S.rapports).filter(function (d) { return S.rapports[d].valideLe && !S.rapports[d].envoye; });
    return l.reduce(function (p, d) { return p.then(function () { return envoyerRapport(d).catch(function () {}); }); }, Promise.resolve());
  }

  // Planifier : réglages, proposition, ajustements, confirmation et partage, communes visitées
  // 3.20.0 : Planifier = l'agenda (frise chronologique de tous les jours planifiés, brouillon ou confirmés).
  // Le parcours de planification s'ouvre sur une page à part, dans le même onglet ; dès les résultats, il disparaît.
  // N'apparaît que ce qui sert sur le moment : « Confirmer » s'il y a des brouillons, « Accepter / Recalculer encore »
  // juste après un recalcul, « Envoyer par WhatsApp » une fois le jour confirmé.
  VUES.semaine = function () {
    if (!S.ui.voirParams) importerAgenda();
    if (S.ui.voirParams) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="fermerParams">' + icone('chevron') + 'Planifier</button>' +
        '<h2 class="titre-vue">Planification</h2><p class="sous-titre">Une question à la fois ; la tournée proposée s\'affiche à la fin.</p>' + rendreParams() + '</div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Planifier</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="voirParams">' + icone('calendrier') + 'Planifier</button></div>';
    var datesF = datesPlanAvenir();
    if (!datesF.length) {
      return h + '<p class="sous-titre">Préparez votre tournée : une journée ou une semaine, une question à la fois.</p>' +
        '<div class="vide"><strong>Aucun jour planifié</strong>Touchez « Planifier » pour préparer votre tournée.</div>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="voirParams">' + icone('calendrier') + 'Planifier ma tournée</button>' +
        boutonAnciens('margin-top:10px');
    }
    var dates = datesF;
    // 3.25.0 : à l'ouverture (et après rafraîchissement), demain est sélectionné par défaut
    if (!S.ui.planInit) { S.ui.planInit = true; var j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1)); S.ui.jour = dates.filter(function (x) { return x >= j1; })[0] || dates[dates.length - 1]; }
    choisirJour(dates);
    var d = S.ui.jour, enAttente = S.ui.aAccepter === d;
    if (S.ui.annulReprise) {
      h += '<section class="bandeau-prog reprise"><div><b>Programme repris</b><span>' + esc(S.ui.annulReprise.libelle) +
        '. Conservez-le, ou revenez à l\'ancienne planification.</span></div><div class="rangee">' +
        '<button class="bouton bouton-plein" type="button" data-a="repriseConserver">' + icone('valider') + 'Conserver</button>' +
        '<button class="bouton" type="button" data-a="repriseAnnuler">Revenir à l\'ancienne</button></div></section>';
    } else if (!enAttente) h += rendreProgramme();
    h += frisePlanifier(datesPlan().filter(function (x) { return x < aujourdhui(); }).slice(-5).concat(dates), d);
    var duJour = S.plan.filter(function (a) { return a.date === d; });
    var n3 = duJour.filter(function (a) { return +a.note === 3; }).length;
    var totalKm = duJour.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    var etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmé' + (S.jours[d] && S.jours[d].modifieLe ? ', modifié' : '') + '</span>' : '<span class="etiquette alerte">Brouillon</span>';
    h += '<div class="tete-jour-plan"><p class="bilan-jour"><b>' + majuscule(dateLongue(d)) + '</b> : ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      ', environ ' + km(totalKm) + (n3 ? ', dont ' + n3 + ' ★★★' : '') + '.</p>' + etat +
'</div>' +
      // 3.24.14 : bouton texte + icône, centré
      '';
    h += '<ul class="plan-jour">' + duJour.map(rendreLignePlan).join('') + '</ul>';
    if (enAttente) {
      h += '<section class="bandeau-prog accepter"><div><b>Nouvelle sélection</b><span>Elle vous convient ? Acceptez-la, ou recalculez encore (les médecins gardés restent).</span></div>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="refuserProgramme" data-v="jour">Ne pas accepter</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterJour">' + icone('valider') + 'Accepter</button></div></section>';
    } else {
      // 3.25.0 : boutons renommés ; les médecins épinglés « Garder » (et ceux ajoutés à la main) restent au recalcul,
      // la journée se reconstruit autour d'eux, même si un programme existe déjà
      h += '<div class="rangee rangee-tirage"><button class="bouton bouton-plein" type="button" data-a="ajouterTournee">' + icone('plus') + 'Ajouter manuellement</button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + 'Recalculer automatiquement</button></div>' +
        '<p class="discret aide-garder">' + icone('epingle') + 'Épinglez « Garder » les médecins à voir absolument : le recalcul reconstruit la journée autour d\'eux.</p>';
    }
    h += rendreCouverture(dates);
    h += boutonAnciens('margin-top:14px');
    return h;
  };
  // frise de l'agenda : tous les jours qui ont au moins une visite, dans l'ordre ; le jour choisi au centre
  function frisePlanifier(dates, d) {
    var t = aujourdhui();
    return '<div class="bande-jours frise-plan"><div class="bj-jours" role="group" aria-label="Jours planifiés">' + dates.map(function (x, i) {
      var n = S.plan.filter(function (a) { return a.date === x; }).length, ok = jourConfirme(x);
      var saut = i > 0 && joursEcoules(dates[i - 1], x) > 3;
      return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (x < t ? ' passe grise' : '') + (saut ? ' lundi' : '') + '"' + (x < t ? ' disabled aria-disabled="true" title="Jour passé"' : ' data-a="jour" data-v="' + x + '"') + ' aria-pressed="' + (x === d) + '"><small>' +
        JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em>' +
        '<i class="etat-jour ' + (ok ? 'ok' : 'brouillon') + '">' + (ok ? '✓ ' : '• ') + n + '</i></button>';
    }).join('') + '</div></div>';
  }

  // ------------------------------------------------------------------ Reprendre un ancien programme
  function boutonAnciens(style) {
    return '<button class="bouton bouton-large" type="button" data-a="ouvrirAnciens" style="' + style + '">' + icone('relancer') + 'Reprendre un ancien programme</button>';
  }
  // Sources : mes tournées publiées (feuille Plannings, 62 jours) et l'archive du téléphone, hors jours de la tournée en cours
  function anciensProgrammes() {
    var t0 = aujourdhui(), parDate = {}, enCours = ensemble(datesPlanAvenir());
    // 3.24.23 : jours passés de la tournée du téléphone (toujours mémorisés)
    S.plan.forEach(function (a) { if (a.date < t0) (parDate[a.date] = parDate[a.date] || []).push(a); });
    var arch = LS.get('archives', {}), srv = {};
    Object.keys(arch).forEach(function (d) { if (!enCours[d] && !parDate[d]) parDate[d] = arch[d]; });
    // la version publiée (feuille Plannings) complète les jours absents de l'archive du téléphone
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (p.delegue && estMoi(p.delegue) && !enCours[p.date] && !arch[p.date] && !parDate[p.date]) (srv[p.date] = srv[p.date] || []).push(p);
    });
    Object.keys(srv).forEach(function (d) { parDate[d] = srv[d]; });
    var semaines = {};
    Object.keys(parDate).forEach(function (d) {
      if (!parDate[d].length) return;
      var l = lundiDe(d); (semaines[l] = semaines[l] || {})[d] = parDate[d];
    });
    return Object.keys(semaines).sort().reverse().slice(0, 8).map(function (l) { return { lundi: l, jours: semaines[l] }; });
  }
  // Dates cibles : semaine (même jour de la semaine) ou journée choisie dans les réglages
  // Dates cibles : la semaine choisie (même jour de la semaine) ou le jour choisi
  function ciblesReprise(type, source, cible) {
    var m = {};
    if (type === 'semaine') {
      var jours = joursOuvres(lundiDe(cible));
      Object.keys(source).forEach(function (d) { m[d] = jours[jourSemaineIndex(d)]; });
    } else m[Object.keys(source)[0]] = cible;
    return m;
  }
  function cibleParDefaut(type, valeur) {
    var t = prochainJourOuvre(aujourdhui());
    var av = datesPlanAvenir();
    if (type === 'semaine') return lundiDe(av.length ? av[0] : (jourSemaineIndex(aujourdhui()) > 3 ? ajouterJours(aujourdhui(), 7) : aujourdhui()));
    // même jour de la semaine, à partir d'aujourd'hui
    return prochaineOccurrence(jourSemaineIndex(valeur), t, true);
  }
  function reprendreProgramme(type, valeur, cibleChoisie, force) {
    var semaine = anciensProgrammes().filter(function (x) { return x.lundi === (type === 'semaine' ? valeur : lundiDe(valeur)); })[0];
    if (!semaine) return;
    var source = {};
    if (type === 'semaine') source = semaine.jours; else source[valeur] = semaine.jours[valeur];
    var vers = ciblesReprise(type, source, cibleChoisie || cibleParDefaut(type, valeur)), c = ctx(), nouveaux = [], manques = [];
    Object.keys(source).forEach(function (d) {
      var cible = vers[d];
      if (!cible || cible < aujourdhui() || jourSemaineIndex(cible) > 4 || estFerie(cible)) { manques = manques.concat(source[d].map(function (x) { return x.nom; })); return; }
      var j = jourSemaineIndex(cible), vus = {};
      source[d].slice().sort(function (a, b) { return String(a.heure).localeCompare(String(b.heure)); }).forEach(function (x) {
        if (vus[x.code]) return; vus[x.code] = true;
        var pr = c.prat[x.code], crs = (c.parCode[x.code] || []).filter(function (cr) { return cr.jourIdx === j; });
        var cr = crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence) && k.creneau === x.creneau; })[0] ||
                 crs.filter(function (k) { return String(k.idPresence) === String(x.idPresence); })[0] || crs[0];
        if (!pr || !cr || absentLe(pr, cible)) { manques.push(x.nom); return; }
        var a = Moteur.arretDepuisCreneau(cr, cible);
        a.garde = true; a.etat = 'repris';
        nouveaux.push(a);
      });
    });
    var cibles = ensemble(Object.keys(vers).map(function (k) { return vers[k]; }));
    var aRemplacer = S.plan.filter(function (a) { return cibles[a.date] && a.etat !== 'valide' && !a.corrige; });
    if (aRemplacer.some(function (a) { return a.statut; }) && !force) {
      confirmerPuis('Comptes rendus non enregistrés', 'Des comptes rendus non enregistrés sur ces jours seront perdus. Continuer ?', 'Continuer',
        function () { reprendreProgramme(type, valeur, cibleChoisie, true); });
      return;
    }
    // sauvegarde : « Revenir à l'ancienne planification » reste possible tant que la reprise n'est pas conservée
    S.ui.annulReprise = { plan: JSON.parse(JSON.stringify(S.plan)), jours: JSON.parse(JSON.stringify(S.jours)),
      libelle: (type === 'semaine' ? 'Semaine du ' + dateCourte(valeur) + ' reprise sur ' : 'Programme du ' + dateCourte(valeur) + ' repris sur ') +
        (type === 'semaine' ? 'la semaine du ' + dateCourte(lundiDe(vers[Object.keys(vers)[0]])) : 'le ' + dateCourte(vers[valeur])) };
    LS.set('annulReprise', S.ui.annulReprise);
    var gardes = S.plan.filter(function (a) { return !cibles[a.date] || a.etat === 'valide' || a.corrige; });
    var deja = {}; gardes.forEach(function (a) { deja[a.date + '|' + a.code] = true; });
    S.plan = gardes.concat(nouveaux.filter(function (a) { return !deja[a.date + '|' + a.code]; }));
    Object.keys(cibles).forEach(function (d) { if (S.plan.some(function (a) { return a.date === d; })) reordonner(d); });
    // les RDV confirmés tombant sur ces jours sont aussi placés
    rdvProchaines(Object.keys(cibles).sort()).forEach(function (im) {
      if (!S.plan.some(function (x) { return x.code === im.code && x.date >= im.apres; })) placerImpose(im);
    });
    mettreBrouillon(Object.keys(cibles).filter(function (d) { return S.plan.some(function (a) { return a.date === d; }); }));
    S.ui.jour = Object.keys(cibles).sort()[0]; S.ui.feuille = null; S.ui.voirParams = false; S.ui.tab = 'semaine';
    if (type === 'semaine') { S.params.mode = 'semaine'; S.params.dateRef = lundiDe(S.ui.jour); } else if (S.params.mode === 'jour') S.params.dateRef = S.ui.jour;
    sauver(); rendre(); publierPlan(true); window.scrollTo(0, 0);
    toast(nouveaux.length + ' visite' + (nouveaux.length > 1 ? 's' : '') + ' reprise' + (nouveaux.length > 1 ? 's' : '') + ' en brouillon' +
      (manques.length ? ' ; ' + manques.length + ' praticien' + (manques.length > 1 ? 's' : '') + ' absent' + (manques.length > 1 ? 's' : '') + ' ce jour-là (non repris)' : '') + '.', 5000);
  }

  // Médecin déjà prévu par un collègue la même semaine : question « Le remplacer ? » (Oui : un autre praticien ; Non : je le garde)
  function conflitArret(a) {
    if (a.etat === 'valide' || a.statut || a.conflitOk || S.config.demo) return null;
    var l = cibleParCollegues(a.code, a.date);
    return l.length ? l[0] : null;
  }
  function questionConflit(a, cf) {
    return '<div class="conflit"><p>Aussi prévu par <b>' + esc(cf.delegue) + '</b> le ' + dateFr(cf.date) + '. Le remplacer par un autre praticien ?</p>' +
      '<div class="rangee"><button class="bouton petit bouton-plein" type="button" data-a="conflitRemplacer" data-uid="' + a.uid + '">Remplacer</button>' +
      '<button class="bouton petit" type="button" data-a="conflitGarder" data-uid="' + a.uid + '">Non, je le garde</button></div></div>';
  }
  // Candidats pour remplacer une visite : présents ce jour-là, hors tournée, non prévus par un collègue, selon les critères de la tournée ;
  // ceux qui s'insèrent sans retard d'abord, puis par priorité et proximité du lieu remplacé
  function candidatsRemplacement(a) {
    var d = a.date, j = jourSemaineIndex(d), c = ctx(), filtre = filtreCibles(), ex = exclusCollegues([d]);
    var dansPlan = ensemble(S.plan.filter(function (x) { return x.date === d; }).map(function (x) { return x.code; }));
    var origine = coordArret(a), vus = {}, l = [];
    (c.parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dansPlan[cr.code] || cr.code === a.code || ex[cr.code] || (filtre && !filtre(p)) || absentLe(p, d)) return;
      if (d === aujourdhui() && cr.fin <= minutesMaintenant()) return;   // aujourd'hui : seulement ceux encore présents
      if (joursEcoules(p.derniere, d) < (+S.params.delai || 0)) return;
      var dist = origine && cr.coord ? distanceKm(origine, cr.coord) : 99;
      var x = { cr: cr, dist: dist, score: Moteur.scoreDe(p, d) };
      if (!vus[cr.code] || x.dist < vus[cr.code].dist) vus[cr.code] = x;
    });
    Object.keys(vus).forEach(function (k) { l.push(vus[k]); });
    l.sort(function (x, y) { return (y.score - 20 * y.dist) - (x.score - 20 * x.dist); });
    var jour = S.plan.filter(function (x) { return x.date === d && x.uid !== a.uid; });
    return l.slice(0, 25).map(function (x) {
      var n = Moteur.arretDepuisCreneau(x.cr, d);
      var essai = Moteur.ordonnerJour(jour.map(function (y) { return Object.assign({}, y); }).concat([n]), departCoord());
      var place = essai.filter(function (y) { return y.uid === n.uid; })[0];
      x.heure = place ? place.heure : n.heure; x.ok = !essai.some(function (y) { return y.retard; });
      if (d === aujourdhui() && heureVersMinutes(x.heure) !== null && heureVersMinutes(x.heure) < minutesMaintenant()) x.heure = minutesVersHeure(Math.ceil(minutesMaintenant() / 5) * 5);   // aujourd'hui : au plus tôt maintenant
      return x;
    }).sort(function (x, y) { return (y.ok ? 1 : 0) - (x.ok ? 1 : 0); }).slice(0, 12);
  }
  function remplacerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: uid, choix: null };
    rendre();
  }
  function appliquerRemplacement(uid, cle, garder) {
    var a = arret(uid), cr = Moteur.creneauParCle(ctx(), cle); if (!a || !cr) return;
    if (!garder) { S.rejetes[a.code] = true; S.plan = S.plan.filter(function (x) { return x.uid !== uid; }); }
    var n = Moteur.arretDepuisCreneau(cr, a.date); n.etat = 'ajoute'; n.garde = true;
    S.plan.push(n); reordonner(a.date);
    S.ui.feuille = null; S.ui.ouvert = null; marquerModifie(); sauver(); rendre(); publierPlan();
    var placé = arret(n.uid);
    toast((garder ? n.nom + ' ajouté en remplacement de ' + a.nom : a.nom + ' remplacé par ' + n.nom) + (placé ? ' (' + placé.heure + ', ' + n.quartier + ')' : '') + '.', 5000);
  }
  function retirerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.plan = S.plan.filter(function (x) { return x.uid !== a.uid; });
    if (!S.plan.some(function (x) { return x.date === a.date; })) { var rt = LS.get('joursRetires', {}); rt[a.date] = true; LS.set('joursRetires', rt); }
    S.rejetes[a.code] = true;
    S.imposes = S.imposes.filter(function (im) { return im.code !== a.code; });
    reordonner(a.date);
    S.ui.ouvert = null; sauver(); rendre(); publierPlan();
    toast(a.nom + ' retiré de la tournée.');
  }
  // Confirmation avant tout changement de la tournée
  // confirme les jours donnés (par défaut tous les jours en brouillon), puis propose l'envoi par WhatsApp
  function confirmerProgramme(dates) {
    dates = dates && dates.length ? dates : joursBrouillon();
    confirmerJours(dates); S.ui.aAccepter = null;
    S.ui.flashTexte = dates.length === 1 ? majuscule(dateLongue(dates[0])) + ' confirmé' : dates.length + ' jours confirmés';
    sauver(); publierPlan(true);
    S.ui.feuille = { type: 'valide', titre: 'Tournée confirmée', dates: dates };
    S.ui.flashValide = Date.now() + 4000; setTimeout(function () { S.ui.flashValide = 0; rendreSiPossible(); }, 4100);
    rendre();
  }
  // 3.19.0 : toute question se pose en trois boutons : Oui (appliquer), Non (refuser ; action propre à la question,
  // sinon retour à l'écran), Sortir (fermer sans rien changer et quitter le parcours en cours)
  function confirmerPuis(titre, message, libelleOui, action, siNon) {
    S.ui.feuille = { type: 'confirmer', titre: titre, message: message, oui: libelleOui || 'Oui', action: action, non: siNon || null };
    rendre();
  }
  function piedQuestion(ouiAttrs, ouiLib, nonAction) {
    return '<button class="bouton-texte sortir-question" type="button" data-a="sortirQuestion">Sortir</button>' +
      '<button class="bouton" type="button" data-a="' + (nonAction || 'fermerFeuille') + '">Non</button>' +
      '<button class="bouton bouton-plein" type="button" ' + ouiAttrs + '>' + ouiLib + '</button>';
  }

  // Ligne compacte de la tournée (Planifier) : garder, retirer, ouvrir la visite
  function rendreLignePlan(a) {
    var verrou = a.etat === 'valide', e = '';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + '</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici</span>';
    e += etiquetteCollegues(a.code, a.date);
    return '<li class="ligne-plan' + classeType(a) + (a.garde ? ' gardee' : '') + (verrou ? ' faite' : '') + '">' +
      '<span class="lp-heure">' + esc(heureVisite(a)) + '</span>' +
      '<button type="button" class="lp-corps" data-a="voirVisite" data-uid="' + a.uid + '">' + pastilleType(a) + '<b>' + esc(a.nom) + '</b> ' + etoiles(a.note) +
        (infosSansDoublon(a, [a.specialite, a.quartier]) ? '<span class="discret bloc-texte">' + esc(infosSansDoublon(a, [a.specialite, a.quartier])) + '</span>' : '') + (e ? '<span class="etiquettes">' + e + '</span>' : '') + '</button>' +
      (verrou ? '<span class="lp-fait" title="Compte Rendu enregistré">' + icone('valider') + '</span>' :
        '<span class="lp-actions"><button type="button" class="lp-garder" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde + '" aria-label="' +
          (a.garde ? 'Ne plus garder' : 'Garder au prochain calcul') + '">' + icone('epingle') + '<small>' + (a.garde ? 'Gardé' : 'Garder') + '</small></button>' +
        '<button type="button" class="lp-retirer" data-a="retirer" data-uid="' + a.uid + '" aria-label="Retirer de la tournée">' + icone('fermer') + '</button></span>') +
      (conflitArret(a) ? questionConflit(a, conflitArret(a)) : '') +
      '</li>';
  }

  // Résumé de la planification : le titre (période), puis une tuile par option ; touchez une tuile pour la modifier
  function rendreResume() {
    var et = etapesParams(), quand = et.filter(function (e) { return e.id === 'quand'; })[0];
    return '<section class="bloc resume-plan"><div class="tete-bloc"><button type="button" class="titre-tuile" data-a="resumeEditer" data-v="quand"><h3>' + esc(quand.resume()) + '</h3>' + icone('crayon') + '</button>' +
      '<button class="bouton petit" data-a="voirParams" type="button">' + icone('calendrier') + 'Planifier</button></div>' +
      '<div class="tuiles-resume">' + et.filter(function (e) { return e.id !== 'quand'; }).map(function (e) {
        return '<button type="button" class="tuile" data-a="resumeEditer" data-v="' + e.id + '"><small>' + esc({ ou: 'Communes', qui: 'Praticiens', spec: 'Spécialités', valeur: 'Potentiel', rythme: 'Rythme', rdv: 'RDV et prioritaires' }[e.id] || e.titre) + '</small><b>' + esc(e.resume()) + '</b></button>';
      }).join('') + '</div></section>';
  }

  // Planification de la tournée posée une question à la fois, comme le compte rendu et la recherche :
  // Quand ? > Où ? > Qui ? > Quelle spécialité ? > Quel potentiel ? > Quel rythme ? > RDV et prioritaires ? puis « Proposer ma tournée ».
  S.ui.etapesP = LS.get('etapesParams', null) || { ok: {} };
  if (!LS.get('etapesParams', null) && S.plan.length) ['quand', 'ou', 'qui', 'spec', 'valeur', 'rythme', 'rdv'].forEach(function (k) { S.ui.etapesP.ok[k] = true; });
  function sauverEtapesP() { LS.set('etapesParams', S.ui.etapesP); }
  // 3.17.0 : ouvrir Planifier reprend toujours le parcours à l'étape 1 (réponses précédentes conservées)
  function etapesPDepuisDebut() { S.ui.etapesP = { ok: {} }; sauverEtapesP(); }
  function etapesParams() {
    var p = S.params, dates = datesAffichees();
    var l = [
      { id: 'quand', titre: 'Période', resume: function () { return p.mode === 'jour' ? 'Journée du ' + dateCourte(p.dateRef) : (dates.length && dates[0] !== lundiDe(dates[0]) ? 'Du ' + dateCourte(dates[0]) + ' au ' + dateCourte(dates[dates.length - 1]) : 'Semaine du ' + dateCourte(dates[0])); },
        rendu: function () {
          return '<div class="segment" role="group" aria-label="Durée" style="margin-top:8px">' +
              '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
              '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button></div>' +
            '<label class="champ" style="margin-bottom:0"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
              '<input type="date" data-f="param" data-k="dateRef" min="' + aujourdhui() + '" value="' + esc(p.dateRef) + '"></label>' +
              (p.mode === 'semaine' && lundiDe(p.dateRef) < aujourdhui() ? '<p class="discret" style="margin:6px 0 0">Semaine entamée : seuls les jours à venir seront planifiés.</p>' : '') + bandeauFeries(dates) + bandeauDejaPlanifie(datesPeriode());
        } },
      { id: 'ou', titre: 'Communes ciblées', resume: function () { return p.mode === 'semaine' && p.parJour ? 'Communes différentes selon le jour' : libelleCommunes(p.communes); },
        rendu: function () {
          var h = '<div class="champ" style="margin:8px 0 0"><span>Communes</span>' +
            '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout">' + esc(libelleCommunes(p.communes)) + '<b>▾</b></button></div>';
          if (p.mode === 'semaine') {
            h += '<label class="interrupteur"><span>Communes différentes selon le jour</span>' +
              '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
            if (p.parJour) {
              h += '<div class="secteurs">' + JOURS.map(function (j, i) {
                var c = p.communesJour[i];
                return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '">' +
                  esc(c && c.length ? libelleCommunes(c) : 'Comme ci-dessus') + '<b>▾</b></button></div>';
              }).join('') + '</div>';
            }
          }
          return h;
        } },
      { id: 'qui', titre: 'Praticiens à visiter', auto: true, resume: function () { return { tous: 'Médecins et pharmacies', medecins: 'Médecins', pharmacies: 'Pharmacies' }[p.typeCibles || 'tous']; },
        rendu: function () {
          return '<div class="puces">' + [['medecins', 'Médecins'], ['pharmacies', 'Pharmacies'], ['tous', 'Tous']].map(function (x) {
            return '<button type="button" class="puce" data-a="param" data-k="typeCibles" data-v="' + x[0] + '" data-auto="qui" aria-pressed="' + ((p.typeCibles || 'tous') === x[0]) + '">' + x[1] + '</button>';
          }).join('') + '</div>';
        } },
      { id: 'spec', titre: 'Spécialités', si: p.typeCibles !== 'pharmacies', facultatif: true, resume: function () { return libelleListe(p.specialites, 'Toutes'); },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + esc(libelleListe(p.specialites, 'Toutes les spécialités')) + (p.typeCibles === 'tous' ? ' (les pharmacies restent incluses)' : '') + '</p>' +
            '<button type="button" class="bouton petit" data-a="choisirSpecialites">' + icone('loupe') + 'Choisir les spécialités</button>';
        } },
      { id: 'valeur', titre: 'Potentiel', facultatif: true, resume: function () { return p.potentiels.length ? p.potentiels.map(function (x) { return ETOILES[x]; }).join(' · ') : 'Tous'; },
        rendu: function () {
          return '<div class="puces">' + ['A', 'B', 'C'].map(function (x) {
            return '<button type="button" class="puce" data-a="paramPotentiel" data-v="' + x + '" aria-pressed="' + (p.potentiels.indexOf(x) >= 0) + '">' + ETOILES[x] + '<small>' + LIB_POTENTIEL[x] + '</small></button>';
          }).join('') + '</div><span class="aide-champ">Aucun choix : tous les potentiels.</span>';
        } },
      { id: 'rythme', titre: 'Rythme de visite', resume: function () {
          return p.maxJour + '/jour · ' + p.delai + ' j mini' + (!S.config.demo && p.eviterCollegues !== false ? ' · hors collègues' : ''); },
        rendu: function () {
          return '<div class="grille-2" style="margin-top:8px">' +
              '<label class="champ"><span>Visites par jour</span><input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '"></label>' +
              '<label class="champ"><span>Ne pas revoir avant (jours)</span><input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '"></label></div>' +
            (S.config.demo ? '' : '<label class="interrupteur" style="margin-bottom:0"><span>Éviter les médecins déjà prévus par un collègue</span>' +
              '<input type="checkbox" data-f="param" data-k="eviterCollegues"' + (p.eviterCollegues !== false ? ' checked' : '') + '></label>');
        } },
      { id: 'rdv', titre: 'RDV et prioritaires', resume: function () {
          var n = rdvProchaines(dates).length, m = S.imposes.length, r = [];
          if (n) r.push(n + ' RDV déjà pris'); if (m) r.push(m + ' prioritaire' + (m > 1 ? 's' : ''));
          return r.length ? r.join(' · ') : 'Aucun'; },
        rendu: function () {
          // RDV confirmés dans les comptes rendus (placés d'office automatiquement) + prioritaires ajoutés à la main
          var rdv = rdvProchaines(dates), h = '<p class="discret" style="margin:4px 0 8px">Placés d\'office : la tournée se construit autour d\'eux.</p>';
          h += '<span class="sous-etape">RDV déjà pris</span>';
          h += rdv.length ? '<ul class="liste-imposes">' + rdv.map(function (im) {
            var pr = praticien(im.code), passe = im.dateRdv < dates[0];
            return '<li><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">RDV du ' + dateFr(im.dateRdv).slice(0, -5) +
              (passe ? ', date passée : au plus tôt' : '') + (function () {
                // RDV un jour sans présence connue : placé à la prochaine présence connue, et on le dit
                var crs = ctx().parCode[im.code] || [], jour = jourSemaineIndex(im.dateRdv);
                if (passe || crs.some(function (cr) { return cr.jourIdx === jour; })) return '';
                var suiv = dates.filter(function (d) { return d >= im.dateRdv && !estFerie(d) && crs.some(function (cr) { return cr.jourIdx === jourSemaineIndex(d); }); })[0];
                return suiv ? ' reporté au ' + dateFr(suiv).slice(0, -5) + ' pour absence' : ', absent sur la période';
              })() + '</span></div><span class="etiquette p1">RDV</span></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun RDV pris sur cette période.</p>';
          h += '<div class="imposes-tete" style="margin-top:12px"><span class="sous-etape" style="margin:0">Prioritaires ajoutés</span>' +
            '<button type="button" class="bouton petit" data-a="ouvrirRecherche">' + icone('plus') + 'Ajouter</button></div>';
          h += S.imposes.length ? '<ul class="liste-imposes">' + S.imposes.map(function (im, i) {
            var pr = praticien(im.code);
            var c = im.cle ? Moteur.creneauParCle(ctx(), im.cle) : null;
            var quand = im.date ? dateFr(im.date) + (c ? ', ' + c.creneau.toLowerCase() + ', ' + esc(c.lieu) : '') : 'Au meilleur moment de la période';
            return '<li><div><b>' + esc(pr ? pr.nom : im.code) + '</b> ' + (pr ? etoiles(pr.note) : '') +
              '<span class="discret bloc-texte">' + quand + (im.rdv ? ', RDV ' + esc(im.rdv) : '') + '</span></div>' +
              '<button type="button" class="bouton-icone sombre" data-a="retirerImpose" data-i="' + i + '" aria-label="Retirer">' + icone('fermer') + '</button></li>';
          }).join('') + '</ul>' : '<p class="discret" style="margin:4px 0 0">Aucun.</p>';
          return h;
        } }
    ];
    return l.filter(function (e) { return e.si !== false; });
  }
  // navigation d'une étape, commune à Planifier et à la Recherche : Précédent (sauf la 1re), Passer (si la question s'y prête),
  // Suivant (Terminer à la dernière)
  function boutonsEtape(aPrec, idPrec, aPasser, aOk, id, dernier) {
    return '<div class="rangee cr-boutons nav-etapes">' +
      (aPrec ? '<button class="bouton nav-prec" type="button" data-a="' + aPrec + '" data-v="' + idPrec + '">' + icone('chevron') + 'Précédent</button>' : '') +
      (aPasser ? '<button class="bouton" type="button" data-a="' + aPasser + '" data-v="' + id + '">Passer</button>' : '') +
      '<button class="bouton bouton-plein nav-suiv" type="button" data-a="' + aOk + '" data-v="' + id + '">' + (dernier ? 'Terminer' : 'Suivant' + icone('chevron')) + '</button></div>';
  }
  function rendreParams() {
    var ok = S.ui.etapesP.ok, etapes = etapesParams(), n = etapes.length;
    var enCours = etapes.filter(function (e) { return !ok[e.id]; })[0];
    var h = '<section class="bloc"><div class="cr-pas etapes-filtres">';
    etapes.forEach(function (e, i) {
      if (ok[e.id]) {
        h += '<button type="button" class="cr-fait" data-a="pEtapeEditer" data-v="' + e.id + '"><span>' + e.titre + '</span><b>' + esc(e.resume()) + '</b>' + icone('crayon') + '</button>';
        return;
      }
      if (e !== enCours) return;
      h += '<div class="cr-question"><span class="etape-titre">' + e.titre + ' <small>étape ' + (i + 1) + '/' + n + (e.facultatif ? ', facultatif' : '') + '</small></span>' + e.rendu();
      h += boutonsEtape(i > 0 ? 'pEtapePrec' : '', i > 0 ? etapes[i - 1].id : '', e.facultatif ? 'pEtapePasser' : '', 'pEtapeOk', e.id, i === n - 1);
      h += '</div>';
    });
    h += '</div>';
    if (enCours) return h + '</section>';
    // toutes les questions sont répondues : on peut proposer
    h += bandeauDejaPlanifie(datesPeriode()) + '<button class="bouton bouton-plein bouton-large" data-a="generer" type="button" style="margin-top:10px">' + icone('relancer') + 'Proposer ma tournée</button>' +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var h = '';
    // 3.19.0 : le bandeau vert ne s'affiche que quelques secondes après la confirmation
    if (S.ui.flashValide && Date.now() < S.ui.flashValide) {
      h += '<section class="bandeau-prog valide flash"><div><b>Tournée confirmée</b><span>' + esc(S.ui.flashTexte || '') + '. Visible par l\'équipe.</span></div></section>';
    }
    var b = joursBrouillon();
    if (!b.length) return h;
    return h + '<section class="bandeau-prog"><div><b>Brouillon</b><span>' + (b.length > 1 ? b.length + ' jours à confirmer : ' : 'À confirmer : ') +
      b.slice(0, 6).map(dateCourte).join(', ') + (b.length > 6 ? '…' : '') + '</span></div>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="refuserProgramme">Ne pas accepter</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="accepterProgramme">' + icone('valider') + 'Accepter</button></div></section>';
  }

  // ------------------------------------------------------------------ Compte Rendu de visite (arbre de décision, 3.5.0)
  // Médecin : faite ? → types → produits présentés → réactions → échantillons → bilan → suite (rappel ou RDV confirmé + date)
  // Pharmacie : faite ? → interlocuteur → activités → stocks → commande → compléments → suite
  // Non faite : motif → précision → remplaçant → suite. Seul un RDV confirmé place la visite dans la tournée.
  var REACTIONS = ['Intéressé', 'Indécis', 'Non intéressé', 'Demande d\'informations', 'Non évalué'];
  var ETATS_STOCK = ['En stock', 'Stock faible', 'Rupture', 'Non référencé', 'Non vérifié'];
  var ANOMALIES = ['Proche péremption', 'Périmé'];
  var INTERLOCUTEURS = ['Pharmacien', 'Équipe', 'Responsable des achats', 'Autre'];
  var SUITES = {
    medecin: [['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['informations', 'Envoyer des informations'], ['aucune', 'Aucune']],
    pharmacie: [['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['commande', 'Suivi de commande'], ['informations', 'Informations'], ['aucune', 'Aucune']],
    nonFaite: [['reprogrammer', 'Reprogrammer'], ['appeler', 'Appeler'], ['aucune', 'Aucune']]
  };
  function activitesPharmacie() { return (S.data && S.data.activitesPharmacie && S.data.activitesPharmacie.length) ? S.data.activitesPharmacie : ACTIVITES_PHARMACIE_DEFAUT; }
  function statutFaite() { var l = statuts().filter(function (s) { return s.visite; }); return (l.filter(function (s) { return s.nom === 'Visite faite'; })[0] || l[0] || { nom: 'Visite faite' }).nom; }
  function motifsPour(a) {
    var base = estPharmacie(a) ? MOTIFS_PHARMACIE : MOTIFS_MEDECIN, connus = statuts().filter(function (s) { return !s.visite; }).map(function (s) { return s.nom; });
    var l = base.filter(function (m) { return !connus.length || connus.indexOf(m) >= 0; });
    return l.length ? l : base;
  }
  // compte rendu structuré de l'arrêt (reconstruit depuis les anciens champs si besoin)
  function crDe(a) {
    if (!a.cr) {
      var c = { types: listeActivites(a.activite), produits: [], reactions: {}, echQ: {}, stocks: {}, cmdQ: {}, besoin: [], retourQ: {}, actionProduits: [] };
      if (a.statut) { if (estKo(a.statut)) { c.faite = 'non'; c.motif = a.statut; c.precision = a.commentaire || ''; } else { c.faite = 'oui'; c.bilan = a.commentaire || ''; c.commentaire = a.commentaire || ''; } }
      var lp = listeProduits(a.produits), ref = produitsRef();
      c.produits = lp.filter(function (x) { return ref.indexOf(x) >= 0; }); c.autres = lp.filter(function (x) { return ref.indexOf(x) < 0; }).join(', ');
      if (c.produits.length || c.autres) c.presentes = 'oui';
      if (a.prochaine) { c.suite = c.faite === 'non' ? 'reprogrammer' : 'visite'; c.suiteType = 'rdv'; c.date = a.prochaine; }
      a.cr = c;
    }
    return a.cr;
  }
  function implicite(a, c) {
    var t = c.types || [];
    return estPharmacie(a) ? { stocks: t.indexOf('Stocks') >= 0, commande: t.indexOf('Commande') >= 0 }
      : { presentes: t.indexOf('Présentation produit') >= 0, echant: t.indexOf('Échantillons') >= 0 };
  }
  function produitsPresentes(c) { return (c.produits || []).concat(listeProduits(c.autres)); }
  function listeQ(o) { return Object.keys(o || {}).filter(function (p) { return +o[p] > 0; }).map(function (p) { return p + ' × ' + (+o[p]); }).join(' ; '); }
  // champs envoyés à l'historique (colonnes de la feuille Historique)
  function champsCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), r = { interlocuteur: '', reactions: '', echantillons: '', stocks: '', commande: '', complements: '', suite: '' };
    if (c.faite === 'oui') {
      r.statut = statutFaite(); r.activite = (c.types || []).join(' ; ');
      if (!ph) {
        var pres = c.presentes === 'oui' || im.presentes ? produitsPresentes(c) : [];
        r.produits = pres.join(', ');
        r.reactions = pres.filter(function (p) { return c.reactions[p]; }).map(function (p) { return p + ' : ' + c.reactions[p].toLowerCase(); }).join(' ; ');
        if (c.echant === 'oui' || im.echant) r.echantillons = listeQ(c.echQ);
        r.commentaire = c.bilan || '';
      } else {
        r.interlocuteur = c.interlocuteur || '';
        if (c.stocksVerif === 'oui' || im.stocks) {
          r.stocks = Object.keys(c.stocks).filter(function (p) { return c.stocks[p] && c.stocks[p].etat; }).map(function (p) {
            var s = c.stocks[p]; return p + ' : ' + s.etat.toLowerCase() + (s.qte ? ' (' + s.qte + ')' : '') + (s.anomalie ? ', ' + s.anomalie.toLowerCase() + (s.lot ? ' lot ' + s.lot : '') : '');
          }).concat(c.autresStock ? ['Autres : ' + c.autresStock] : []).join(' ; ');
          r.produits = Object.keys(c.stocks).filter(function (p) { return c.stocks[p] && (c.stocks[p].etat === 'En stock' || c.stocks[p].etat === 'Stock faible'); }).join(', ');
        }
        if (c.commande === 'oui' || im.commande) r.commande = listeQ(c.cmdQ);
        else if (c.commande === 'non' && ((c.besoin || []).length || c.besoinTexte)) r.commande = 'Besoin : ' + (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []).join(', ');
        var t = c.types || [], comp = [];
        if (t.indexOf('Échantillons') >= 0 && listeQ(c.echQ)) { comp.push('Échantillons : ' + listeQ(c.echQ)); r.echantillons = listeQ(c.echQ); }
        if (t.indexOf('Retour ou échange') >= 0 && (listeQ(c.retourQ) || c.retourMotif)) comp.push('Retour/échange : ' + listeQ(c.retourQ) + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''));
        var act = t.filter(function (x) { return ['PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
        if (act.length && (c.action || (c.actionProduits || []).length)) comp.push(act.join(', ') + ' : ' + (c.action || '') + ((c.actionProduits || []).length ? ' (' + c.actionProduits.join(', ') + ')' : ''));
        r.complements = comp.join(' ; ');
        r.commentaire = c.commentaire || '';
      }
    } else if (c.faite === 'non') {
      r.statut = c.motif || ''; r.activite = ''; r.produits = ''; r.commentaire = c.precision || '';
    }
    var lib = (SUITES[c.faite === 'non' ? 'nonFaite' : (ph ? 'pharmacie' : 'medecin')].filter(function (x) { return x[0] === c.suite; })[0] || [])[1];
    if (c.suite && c.suite !== 'aucune' && c.suiteType && c.date) {
      r.suite = (c.suiteType === 'rdv' ? 'RDV confirmé : ' : 'Rappel : ') + (lib || '').toLowerCase();
      r.prochaine = c.date; r.rdv = c.suiteType === 'rdv';
    } else { r.prochaine = ''; r.rdv = false; }
    return r;
  }
  // garde les champs habituels de l'arrêt à jour (statut, activité, produits, commentaire, prochaine étape)
  function syncCr(a) {
    var r = champsCr(a);
    a.statut = r.statut || ''; a.activite = r.activite || ''; a.produits = r.produits || ''; a.commentaire = r.commentaire || '';
    a.prochaine = r.prochaine || ''; a.rdvConfirme = !!r.rdv;
    horodater(a);
  }
  // 3.25.9 : heure d'enregistrement de la visite (horodatage), affichée dans Journée à la place de l'heure planifiée
  function horodater(a) {
    if (!a.statut) { delete a.valideA; return; }
    if (!a.valideA && a.date === aujourdhui()) a.valideA = minutesVersHeure(minutesMaintenant());
  }
  function manquesCr(a) {
    var c = crDe(a), m = [];
    if (!c.faite) m.push('indiquez si la visite a été faite');
    else if (c.faite === 'non' && !c.motif) m.push('choisissez le motif');
    if (c.suite && c.suite !== 'aucune' && (!c.suiteType || !c.date)) m.push('précisez rappel ou RDV confirmé et la date');
    return m;
  }

  // petits éléments de formulaire
  function puceCr(a, cle, v, lib, actif, multi) {
    return '<button type="button" class="puce" data-a="' + (multi ? 'crMulti' : 'crChoix') + '" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(v) +
      '" aria-pressed="' + !!actif + '">' + esc(lib || v) + '</button>';
  }
  // Composants du compte rendu, alignés sur Planifier : 2 choix = segment (comme « Une journée | Une semaine »),
  // jusqu'à 5 = puces, au-delà = sélecteur qui ouvre la liste (comme « Communes » ou « Spécialités »).
  S.ui.crOptions = {};
  function optionsNorm(options) { return options.map(function (o) { return Array.isArray(o) ? o : [o, o]; }); }
  function selecteurCr(a, cle, options, vals, multi, vide) {
    S.ui.crOptions[a.uid + '|' + cle] = optionsNorm(options);
    var libs = optionsNorm(options).filter(function (o) { return vals.indexOf(o[0]) >= 0; }).map(function (o) { return o[1]; });
    return '<div class="champ" style="margin:8px 0 0"><button type="button" class="selecteur" data-a="crListe" data-uid="' + a.uid + '" data-k="' + cle + '" data-m="' + (multi ? 1 : 0) + '">' +
      esc(libs.length ? libs.join(', ') : vide) + '<b>▾</b></button></div>';
  }
  function choixCr(a, cle, options, val) {
    var o = optionsNorm(options);
    if (o.length === 2) return '<div class="segment" role="group" style="margin:8px 0 0">' + o.map(function (x) {
      return '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    if (o.length > 5) return selecteurCr(a, cle, o, val ? [val] : [], false, 'Choisir…');
    return '<div class="puces">' + o.map(function (x) { return puceCr(a, cle, x[0], x[1], val === x[0]); }).join('') + '</div>';
  }
  function multiCr(a, cle, options, vals) {
    if (options.length > 4) return selecteurCr(a, cle, options, vals || [], true, 'Choisir');
    return '<div class="puces">' + options.map(function (o) { return puceCr(a, cle, o, o, (vals || []).indexOf(o) >= 0, true); }).join('') + '</div>';
  }
  function ouiNonCr(a, cle, val) { return choixCr(a, cle, [['oui', 'Oui'], ['non', 'Non']], val); }
  function ouiNonCrAncien(a, cle, val) { return '<div class="statuts deux">' + [['oui', 'Oui'], ['non', 'Non']].map(function (o) {
    return '<button type="button" class="statut' + (o[0] === 'non' ? ' ko' : '') + '" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + o[0] + '" aria-pressed="' + (val === o[0]) + '">' + o[1] + '</button>';
  }).join('') + '</div>'; }
  function texteCr(a, cle, val, ph, zone) {
    return zone ? '<textarea data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" placeholder="' + esc(ph) + '">' + esc(val || '') + '</textarea>'
      : '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="' + esc(ph) + '">';
  }
  function qteCr(a, cle, val) { return '<input type="number" min="0" inputmode="numeric" class="qte" data-f="cr" data-uid="' + a.uid + '" data-k="' + cle + '" value="' + esc(val || '') + '" placeholder="0" aria-label="Quantité">'; }
  // choix unique en puces (remplace les listes déroulantes du compte rendu) : touchez de nouveau pour annuler
  function pucesValCr(a, cle, options, val, libs) {
    return '<div class="puces">' + options.map(function (o) {
      return '<button type="button" class="puce" data-a="crVal" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(o) + '" aria-pressed="' + ((val || '') === o) + '">' + esc((libs && libs[o]) || o) + '</button>';
    }).join('') + '</div>';
  }
  function selectCr(a, cle, options, val, vide) {
    return '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="' + cle + '">' + (vide !== undefined ? '<option value="">' + esc(vide) + '</option>' : '') +
      options.map(function (o) { return '<option' + (o === val ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select>';
  }
  function etapeCr(titre, contenu, aide) { return '<div class="champ etape-cr-bloc"><span>' + titre + '</span>' + contenu + (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '</div>'; }
  function tableQ(a, prefixe, produits, valeurs) {
    return '<div class="grille-2 champs-cr">' + produits.map(function (p) {
      return '<label class="champ"><span>' + esc(p) + '</span>' + qteCr(a, prefixe + '.' + p, (valeurs || {})[p]) + '</label>';
    }).join('') + '</div>';
  }

  // ------------------------------------------------------------------ Compte Rendu pas à pas (3.6.0)
  // Une question à la fois : la suivante apparaît selon la réponse. Les réponses données restent en lignes courtes
  // (touchez pour modifier : les questions suivantes sont reposées). Étapes facultatives : Continuer ou Passer.
  function etapesCr(a) {
    var c = crDe(a), ph = estPharmacie(a), im = implicite(a, c), cat = produitsRef(), l = [];
    function e(id, titre, type, rendu, resume, ok) { l.push({ id: id, titre: titre, type: type, rendu: rendu, resume: resume, valide: ok }); }
    var oui = function (v) { return v === 'oui' ? 'Oui' : (v === 'non' ? 'Non' : ''); };
    e('faite', 'La visite a-t-elle été faite ?', 'auto', function () { return ouiNonCr(a, 'faite', c.faite); }, function () { return oui(c.faite); });
    if (!c.faite) return l;
    if (c.faite === 'non') {
      e('motif', 'Motif', 'auto', function () { return choixCr(a, 'motif', motifsPour(a), c.motif); }, function () { return c.motif; });
      e('precision', 'Précision', 'facultatif', function () { return texteCr(a, 'precision', c.precision, ph ? 'Ex. pharmacien en congé jusqu\'à lundi' : 'Ex. en bloc opératoire, revenir après 15 h', true); },
        function () { return c.precision || 'aucune'; });
      e('remplacant', 'Trouver un remplaçant à proximité ?', 'auto', function () { return choixCr(a, 'remplacant', [['oui', 'Oui'], ['non', 'Non']], c.remplacant); }, function () { return oui(c.remplacant); });
      if (c.remplacant === 'oui') { l.push({ id: '__remplacer', fin: 'remplacer' }); return l; }
      etapesSuite(a, c, SUITES.nonFaite, e);
      return l;
    }
    if (!ph) {
      e('types', 'Type(s) de visite', 'continuer', function () { return multiCr(a, 'types', activites(), c.types); }, function () { return (c.types || []).join(', '); },
        function () { return (c.types || []).length ? '' : 'choisissez au moins un type'; });
      if (!im.presentes) e('presentes', 'Produits présentés ?', 'auto', function () { return choixCr(a, 'presentes', [['oui', 'Oui'], ['non', 'Non']], c.presentes); }, function () { return oui(c.presentes); });
      if (c.presentes === 'oui' || im.presentes) {
        e('produits', 'Produits présentés', 'continuer', function () {
          return multiCr(a, 'produits', cat, c.produits) + '<input type="text" list="listeProduits" data-f="cr" data-uid="' + a.uid + '" data-k="autres" value="' + esc(c.autres || '') +
            '" placeholder="Autres produits, séparés par une virgule" aria-label="Autres produits" style="margin-top:8px">' + datalistProduits();
        }, function () { return produitsPresentes(c).join(', '); }, function () { return produitsPresentes(c).length ? '' : 'choisissez au moins un produit'; });
        e('reactions', 'Réaction du médecin', 'continuer', function () {
          return '<div class="champs-cr">' + produitsPresentes(c).map(function (p) {
            return '<div class="champ"><span>' + esc(p) + '</span>' + pucesValCr(a, 'reactions.' + p, REACTIONS, c.reactions[p]) + '</div>';
          }).join('') + '</div>';
        }, function () { var r = produitsPresentes(c).filter(function (p) { return c.reactions[p]; }); return r.length ? r.map(function (p) { return p + ' : ' + c.reactions[p].toLowerCase(); }).join(', ') : 'non renseignée'; });
      }
      if (!im.echant) e('echant', 'Échantillons remis ?', 'auto', function () { return choixCr(a, 'echant', [['oui', 'Oui'], ['non', 'Non']], c.echant); }, function () { return oui(c.echant); });
      if (c.echant === 'oui' || im.echant) e('echQ', 'Échantillons remis (quantités)', 'continuer', function () { return tableQ(a, 'echQ', cat, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
      e('bilan', 'Bilan', 'facultatif', function () { return texteCr(a, 'bilan', c.bilan, 'Besoins, objections, engagements, autres activités…', true); }, function () { return c.bilan || 'aucun'; });
      etapesSuite(a, c, SUITES.medecin, e);
      return l;
    }
    e('interlocuteur', 'Interlocuteur', 'auto', function () { return choixCr(a, 'interlocuteur', INTERLOCUTEURS, c.interlocuteur); }, function () { return c.interlocuteur; });
    e('types', 'Activité(s)', 'continuer', function () { return multiCr(a, 'types', activitesPharmacie(), c.types); }, function () { return (c.types || []).join(', '); },
      function () { return (c.types || []).length ? '' : 'choisissez au moins une activité'; });
    if (!im.stocks) e('stocksVerif', 'Stocks vérifiés ?', 'auto', function () { return choixCr(a, 'stocksVerif', [['oui', 'Oui'], ['non', 'Non']], c.stocksVerif); }, function () { return oui(c.stocksVerif); });
    if (c.stocksVerif === 'oui' || im.stocks) {
      e('stocks', 'Stock par produit', 'continuer', function () {
        return '<div class="champs-cr">' + cat.map(function (p) {
          var s = c.stocks[p] || {};
          return '<div class="ligne-stock"><b>' + esc(p) + '</b><div class="champ"><span>État</span>' + pucesValCr(a, 'stocks.' + p + '.etat', ETATS_STOCK, s.etat) + '</div>' +
            '<label class="champ"><span>Quantité</span>' + qteCr(a, 'stocks.' + p + '.qte', s.qte) + '</label>' +
            (s.etat === 'En stock' || s.etat === 'Stock faible' ? '<div class="champ"><span>Anomalie</span>' + pucesValCr(a, 'stocks.' + p + '.anomalie', [''].concat(ANOMALIES), s.anomalie || '', { '': 'Aucune' }) + '</div>' +
              (s.anomalie ? '<label class="champ"><span>N° de lot</span><input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="stocks.' + p + '.lot" value="' + esc(s.lot || '') + '" placeholder="N° de lot"></label>' : '') : '') + '</div>';
        }).join('') + '</div>' + texteCr(a, 'autresStock', c.autresStock, 'Autres produits et état, ex. Doliprane rupture') +
          '<span class="aide-champ">Rupture, non référencé et non vérifié sont distincts. Une commande ne modifie pas le stock avant réception.</span>';
      }, function () { var r = champsCr(a).stocks; return r || 'aucun produit renseigné'; });
    }
    if (!im.commande) e('commande', 'Commande passée ?', 'auto', function () { return choixCr(a, 'commande', [['oui', 'Oui'], ['non', 'Non']], c.commande); }, function () { return oui(c.commande); });
    if (c.commande === 'oui' || im.commande) e('cmdQ', 'Commande (quantités)', 'continuer', function () { return tableQ(a, 'cmdQ', cat, c.cmdQ); }, function () { return listeQ(c.cmdQ) || 'aucune quantité'; });
    else if (c.commande === 'non') e('besoin', 'Besoin de réapprovisionnement', 'facultatif', function () { return multiCr(a, 'besoin', cat, c.besoin) + texteCr(a, 'besoinTexte', c.besoinTexte, 'Autres besoins'); },
      function () { var b = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []); return b.length ? b.join(', ') : 'aucun'; });
    var t = c.types || [];
    if (t.indexOf('Échantillons') >= 0) e('echQ', 'Échantillons (quantités)', 'continuer', function () { return tableQ(a, 'echQ', cat, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
    if (t.indexOf('Retour ou échange') >= 0) e('retour', 'Retour ou échange', 'continuer', function () { return tableQ(a, 'retourQ', cat, c.retourQ) + texteCr(a, 'retourMotif', c.retourMotif, 'Motif du retour ou de l\'échange'); },
      function () { return (listeQ(c.retourQ) || 'aucune quantité') + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''); });
    var act = t.filter(function (x) { return ['PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
    if (act.length) e('action', act.join(', ') + ' : action et produits', 'continuer', function () { return texteCr(a, 'action', c.action, 'Ex. présentoir installé, équipe formée sur Rozukaa') + multiCr(a, 'actionProduits', cat, c.actionProduits); },
      function () { return [c.action].concat(c.actionProduits || []).filter(Boolean).join(', ') || 'non précisé'; });
    e('commentaire', 'Commentaire', 'facultatif', function () { return texteCr(a, 'commentaire', c.commentaire, 'Demande du pharmacien, concurrence, prix…', true); }, function () { return c.commentaire || 'aucun'; });
    etapesSuite(a, c, SUITES.pharmacie, e);
    return l;
  }
  function etapesSuite(a, c, options, e) {
    var lib = function (v) { return ((options.filter(function (o) { return o[0] === v; })[0]) || [])[1] || ''; };
    e('suite', 'Suite', 'auto', function () { return choixCr(a, 'suite', options, c.suite); }, function () { return lib(c.suite); });
    if (!c.suite || c.suite === 'aucune') return;
    e('suiteType', 'Rappel ou RDV confirmé ?', 'auto', function () { return choixCr(a, 'suiteType', [['rappel', 'Rappel'], ['rdv', 'RDV confirmé']], c.suiteType); },
      function () { return c.suiteType === 'rdv' ? 'RDV confirmé' : 'Rappel'; });
    e('date', 'Prochaine étape le', 'auto', function () {
      return '<div class="rangee-prochaine">' + [7, 14, 30].map(function (n) {
        var d = ajouterJours(a.date, n);
        return '<button type="button" class="puce" data-a="crDate" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + (c.date === d) + '">+' + n + ' j</button>';
      }).join('') + '</div><label class="champ" style="margin:10px 0 0"><span>Ou une date</span><input type="date" data-f="crSelect" data-uid="' + a.uid + '" data-k="date" value="' + esc(c.date || '') + '" aria-label="Date de la prochaine étape"></label>' +
        '<span class="aide-champ">' + (c.suiteType === 'rappel' ? 'Rappel : il s\'affiche ce jour-là dans « Journée », sans modifier la tournée.' :
          'RDV confirmé : ' + (estPharmacie(a) ? 'la pharmacie est placée' : 'le praticien est placé') + ' d\'office ce jour-là dans vos tournées.') + '</span>';
    }, function () { return c.date ? majuscule(dateLongue(c.date)) : ''; });
  }
  // libellés courts des réponses repliées (comme Planifier : « Période  Journée du… »)
  var TITRES_COURTS = { 'La visite a-t-elle été faite ?': 'Visite faite', 'Trouver un remplaçant à proximité ?': 'Remplaçant', 'Type(s) de visite': 'Types',
    'Activité(s)': 'Activités', 'Produits présentés ?': 'Présentés', 'Produits présentés': 'Produits', 'Réaction du médecin': 'Réaction',
    'Échantillons remis ?': 'Échantillons', 'Échantillons remis (quantités)': 'Échantillons', 'Échantillons (quantités)': 'Échantillons',
    'Rappel ou RDV confirmé ?': 'Rappel / RDV', 'Prochaine étape le': 'Date', 'Stocks vérifiés ?': 'Stocks', 'Stock par produit': 'Stocks',
    'Commande passée ?': 'Commande', 'Commande (quantités)': 'Quantités', 'Besoin de réapprovisionnement': 'Besoin' };
  function titreCourt(t) { return TITRES_COURTS[t] || t; }
  function rendreCompteRendu(a) {
    var c = crDe(a), ok = c.ok || (c.ok = {}), h = '<div class="cr-pas etapes-filtres"><div class="tete-bloc tete-cr"><h3>Compte Rendu</h3></div>';
    var etapes = etapesCr(a);
    for (var i = 0; i < etapes.length; i++) {
      var s = etapes[i];
      if (s.fin === 'remplacer') {
        return h + '<div class="actions-cr"><button class="bouton bouton-plein bouton-large" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' +
          icone('cible') + 'Enregistrer et ouvrir Autour de moi</button></div></div>';
      }
      if (ok[s.id]) {
        h += '<button type="button" class="cr-fait" data-a="crEditer" data-uid="' + a.uid + '" data-v="' + s.id + '"><span>' + esc(titreCourt(s.titre)) + '</span><b>' + esc(s.resume()) + '</b>' + icone('crayon') + '</button>';
        continue;
      }
      // question en cours : la seule affichée
      var err = s.valide ? s.valide() : '';
      h += '<div class="cr-question"><span class="etape-titre">' + esc(s.titre) + ' <small>étape ' + (i + 1) + (s.type === 'facultatif' ? ', facultatif' : '') + '</small></span>' + s.rendu();
      if (s.type !== 'auto') {
        h += '<div class="rangee cr-boutons">' + (s.type === 'facultatif' ? '<button class="bouton" type="button" data-a="crPasser" data-uid="' + a.uid + '" data-v="' + s.id + '">Passer</button>' : '') +
          '<button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="' + s.id + '"' + (err ? ' disabled' : '') + '>Continuer</button></div>' +
          (err ? '<span class="aide-champ">Pour continuer : ' + esc(err) + '.</span>' : '');
      }
      return h + '</div></div>';
    }
    // toutes les questions sont répondues
    return h + '</div>' + boutonEnregistrer(a);
  }
  // réouvre une étape : elle et les suivantes sont reposées (les réponses restent pré-remplies)
  function editerEtape(a, id) {
    var c = crDe(a), l = etapesCr(a), i = l.map(function (s) { return s.id; }).indexOf(id);
    c.ok = c.ok || {};
    l.slice(Math.max(i, 0)).forEach(function (s) { delete c.ok[s.id]; });
    LS.set('plan', S.plan);
  }
  function validerEtape(a, id) { var c = crDe(a); c.ok = c.ok || {}; c.ok[id] = true; LS.set('plan', S.plan); }

  function boutonEnregistrer(a) {
    var m = manquesCr(a);
    return '<div class="actions-cr">' + (m.length ?
      '<button class="bouton bouton-large" type="button" disabled>' + icone('valider') + 'Enregistrer le compte rendu</button><span class="aide-champ">Pour enregistrer : ' + esc(m.join(', ')) + '.</span>' :
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + (a.corrige ? 'Enregistrer la modification' : 'Enregistrer le compte rendu') + '</button>') + '</div>';
  }
  // une valeur par ligne : « Routine, Présentation produit » ou « A ; B » s'affichent l'un sous l'autre
  function parLigne(v) { return String(v || '').split(/\s*;\s*|,\s+(?=[A-ZÉÈÀÂÎÔ0-9★])/).filter(Boolean).map(esc).join('<br>'); }
  function resumeCompteRendu(a, tuiles) {
    var r = champsCr(a), l = [];
    if (r.interlocuteur) l.push('Interlocuteur : ' + r.interlocuteur);
    if (r.activite) l.push('Type de visite : ' + listeActivites(r.activite).join(', '));
    if (r.produits && !estPharmacie(a)) l.push('Produits présentés : ' + r.produits);
    if (r.reactions) l.push('Réactions : ' + r.reactions);
    if (r.echantillons) l.push('Échantillons : ' + r.echantillons);
    if (r.stocks) l.push('Stocks : ' + r.stocks);
    if (r.commande) l.push('Commande : ' + r.commande);
    if (r.complements && !/^Échantillons/.test(r.complements)) l.push(r.complements);
    if (r.commentaire) l.push((crDe(a).faite === 'non' ? 'Précision : ' : 'Bilan : ') + r.commentaire);
    if (r.suite) l.push(r.suite + ' le ' + dateCourte(r.prochaine));
    // 3.25.10 : pharmacie : un produit par carte (état, quantité, anomalie), les uns après les autres
    var cartesStock = '';
    if (tuiles && estPharmacie(a) && r.stocks) {
      var cs = crDe(a), st = cs.stocks || {};
      l = l.map(function (x) { return x.indexOf('Stocks : ') === 0 ? '\u0000stocks' : x; });
      cartesStock = Object.keys(st).filter(function (p) { return st[p] && st[p].etat; }).map(function (p) {
        var x = st[p];
        return '<div class="tuile statique"><small>' + esc(p) + '</small><b>' + esc(x.etat) + '</b>' +
          (x.qte ? '<span class="discret bloc-texte">Quantité : ' + esc(x.qte) + '</span>' : '') +
          (x.anomalie ? '<span class="discret bloc-texte">' + esc(x.anomalie) + (x.lot ? ', lot ' + esc(x.lot) : '') + '</span>' : '') + '</div>';
      }).join('') + (cs.autresStock ? '<div class="tuile statique large"><small>Autres produits</small><b>' + esc(cs.autresStock) + '</b></div>' : '');
    }
    if (tuiles) return '<div class="tuile statique"><small>Résultat</small><b>' + esc(a.statut || '') + '</b></div>' + l.map(function (x) {
      if (x === '\u0000stocks') return cartesStock;
      var i = x.indexOf(' : '), lab = i > 0 ? x.slice(0, i) : (r.suite && x.indexOf(r.suite) === 0 ? 'Suite' : 'Note'), val = i > 0 ? x.slice(i + 3) : x;
      return '<div class="tuile statique' + (val.length > 40 ? ' large' : '') + '"><small>' + esc(lab) + '</small><b>' + parLigne(val) + '</b></div>';
    }).join('');
    return l.map(function (x) { return '<p class="discret">' + esc(x) + '</p>'; }).join('');
  }
  // valeur d'un chemin « a.b.c » dans le compte rendu
  function majCr(a, cle, valeur, multi) {
    var c = crDe(a), p = cle.split('.'), o = c;
    // nom de produit pouvant contenir un point : le 2e élément est le produit, le reste le champ
    if (p.length > 2) p = [p[0], p.slice(1, p.length - 1).join('.'), p[p.length - 1]];
    else if (p.length === 2) p = [p[0], p[1]];
    for (var i = 0; i < p.length - 1; i++) { if (!o[p[i]] || typeof o[p[i]] !== 'object') o[p[i]] = {}; o = o[p[i]]; }
    var k = p[p.length - 1];
    if (multi) { var l = Array.isArray(o[k]) ? o[k] : [], j = l.indexOf(valeur); if (j >= 0) l.splice(j, 1); else l.push(valeur); o[k] = l; }
    else o[k] = valeur;
    if (cle === 'faite' && valeur === 'oui') { c.motif = ''; c.remplacant = ''; }
    if (cle === 'suite' && valeur === 'aucune') { c.suiteType = ''; c.date = ''; }
    syncCr(a); LS.set('plan', S.plan);
  }

  // Rappels du jour (et en retard) : suites « Rappel » de mes comptes rendus, sans visite depuis
  function rappelsDuJour() {
    var t = aujourdhui(), dernier = {}, l = [];
    (S.queue || []).concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.delegue && !estMoi(v.delegue)) return;
      var d = String(v.date || '').slice(0, 10);
      if (!dernier[v.code] || d > dernier[v.code].d) dernier[v.code] = { d: d, v: v };
    });
    Object.keys(dernier).forEach(function (k) {
      var v = dernier[k].v, p = String(v.prochaine || '').slice(0, 10);
      if (/^Rappel/.test(v.suite || '') && p && p <= t) l.push({ v: v, date: p });
    });
    return l.sort(function (x, y) { return x.date < y.date ? -1 : 1; });
  }
  function rendreRappels() {
    var l = rappelsDuJour();
    if (!l.length) return '';
    return '<section class="bloc rappels"><h3 style="margin-top:0">Rappels (' + l.length + ')</h3><ul class="liste-rappels">' + l.map(function (x) {
      var p = praticien(x.v.code) || {};
      return '<li><div><b>' + esc(x.v.nom) + '</b><span class="discret bloc-texte">' + esc(String(x.v.suite).replace(/^Rappel : /, '')) +
        (x.date < aujourdhui() ? ', prévu le ' + dateCourte(x.date) : '') + '</span></div>' +
        (p.telephone ? '<a class="bouton petit" href="tel:' + esc(String(p.telephone).replace(/\s/g, '')) + '">' + icone('tel') + 'Appeler</a>' : '') + '</li>';
    }).join('') + '</ul></section>';
  }

  // jours passés : modifiables seulement si l'option cachée « Modifier les jours passés » (Réglages › Avancé) est activée
  function passeVerrouille(d) { return d < aujourdhui() && !S.config.modifPasse; }
  // jours à venir : aperçu seul, sauf option cachée Réglages › Avancé › « Saisir les jours à venir » (3.16.0)
  function futurVerrouille(d) { return d > aujourdhui() && !S.config.saisieFutur; }
  // état d'une visite en une ligne (carte fermée) : faite + produits, non faite + motif, à saisir, à venir
  function ligneEtat(a) {
    var t = aujourdhui(), now = minutesMaintenant(), hm = heureVersMinutes(a.heure);
    if (a.statut) {
      var ko = estKo(a.statut), pr = !ko && a.produits ? ' · ' + a.produits : '';
      return '<span class="ligne-etat ' + (ko ? 'ko' : 'ok') + '">' + (ko ? '✗ ' : '✓ ') + esc(statutLibelle(a)) + esc(pr) + (a.etat !== 'valide' ? ' · à enregistrer' : '') + '</span>';
    }
    if (a.date < t) return '<span class="ligne-etat alerte">! Compte Rendu à saisir</span>';
    if (a.date === t && hm !== null && hm < now) return '<span class="ligne-etat alerte">! Compte Rendu à saisir' + distanceMoi(a) + '</span>';
    var tag = a.impose ? (a.etape ? libelleRdv(a) : (a.rdv ? 'RDV ' + a.rdv : 'Prioritaire')) : '';
    return '<span class="ligne-etat">○ À venir' + (tag ? ' · ' + esc(tag) : '') + (a.date === t ? distanceMoi(a) : '') + '</span>';
  }
  // 3.23.2 : distance entre moi (GPS) et une visite du jour pas encore faite, pour choisir qui voir en priorité
  function distanceMoi(a) {
    // 3.25.9 : vol d'oiseau depuis le téléphone (le coefficient routier était appliqué deux fois) ; « ≈ » si le lieu n'a pas de GPS
    var pos = S.ui.posGps, cp = pos && Date.now() - pos.t < 5 * 60000 ? coordPrecise(a) : null, c = cp || (pos && Date.now() - pos.t < 5 * 60000 ? coordArret(a) : null);
    if (!c) return '';
    var route = distanceVol(pos, c);
    var d = (cp ? '' : '≈ ') + distanceCourte(route);
    return '<span class="dist-moi' + (route < 0.5 ? ' tout-pres' : '') + '" role="img" aria-label="À ' + d + ' de vous">' + icone('cible') + d + '</span>';
  }
  // Carte d'une visite (Aujourd'hui) : contact d'abord, puis compte rendu en deux temps
  function rendreArret(a) {
    var ouvert = S.ui.ouvert === a.uid, verrou = a.etat === 'valide';
    var cls = 'arret' + (ouvert ? ' ouvert' : '') + (verrou ? ' verrouille' : '') + (a.garde ? ' garde' : '') +
      (a.statut ? (estKo(a.statut) ? (verrou ? ' absent' : ' absent-attente') : (verrou ? ' fait' : ' fait-attente')) : '') +   // plein = enregistré, vide de couleur = à enregistrer
      (S.ui.flashOk && S.ui.flashOk[a.uid] ? ' vient-enregistrer' : '');
    var e = '';
    e += badgeConv(a.conventionne);
    var pv = praticien(a.code) || {}, der = pv.derniere && (!a.derniere || pv.derniere > a.derniere) ? pv.derniere : a.derniere;
    var vu = vuDepuis(der, a.etat !== 'valide' && a.date > aujourdhui() ? a.date : aujourdhui());
    if (estPharmacie(a)) vu = vu.replace(/^Vu /, 'Visitée ').replace('Jamais visité', 'Jamais visitée');
    e += '<span class="etiquette">' + esc(vu) + '</span>';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut && !verrou) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + ', à enregistrer</span>';
    if (a.etat === 'ajoute') e += '<span class="etiquette">Ajouté</span>';
    if (a.etat === 'repris') e += '<span class="etiquette">Repris d\'un ancien programme</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.prochaine && a.prochaine <= a.date && !a.statut && !a.etape) e += '<span class="etiquette p1">RDV prévu le ' + dateCourte(a.prochaine) + '</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici (présent ' + esc(a.fiabTexte) + ')</span>';
    e += etiquetteCollegues(a.code, a.date);

    var h = '<li class="' + cls + '" data-p="' + (+a.note === 3 ? 1 : 3) + '">' +
      '<div class="arret-heure"><b>' + esc((a.statut && a.valideA) || a.heure || (a.creneau ? a.creneau.slice(0, 5) : '--:--')) + '</b>' + (a.debut || a.fin ? '<small>' + esc(a.debut) + '-' + esc(a.fin) + '</small>' : '') + '</div>' +
      '<div class="arret-rail"><span class="arret-noeud"></span></div>' +
      '<div><div class="arret-carte' + classeType(a) + '">' +
        '<button type="button" class="carte-bouton" data-a="ouvrir" data-uid="' + a.uid + '" aria-expanded="' + ouvert + '">' +
          '<span class="arret-nom">' + pastilleType(a) + esc(a.nom) + ' ' + etoiles(a.note) + '</span>' +
          (ouvert ? (lieuEtSpec(a) ? '<span class="arret-lieu">' + esc(lieuEtSpec(a)) + '</span>' : '') +
            '<span class="arret-lieu">' + esc(a.quartier) + ', ' + esc(a.commune) + '</span>' +
            '<span class="etiquettes">' + e + '</span>' : (lieuQuartier(a) ? '<span class="arret-lieu">' + esc(lieuQuartier(a)) + '</span>' : '') + ligneEtat(a)) +
        '</button>' +
        (!ouvert && !a.hors && !passeVerrouille(a.date) && a.statut && estKo(a.statut) && !futurVerrouille(a.date) ? '<button class="bouton petit remplacer-ligne" type="button" data-a="completerJour" data-uid="' + a.uid + '">' + icone('relancer') + 'Remplacer</button>' : '');
    if (ouvert) {
      var pa = praticien(a.code) || {};
      h += '<div class="arret-detail">' +
        actionsRapides({ telephone: pa.telephone, lat: a.lat, lon: a.lon, lieu: a.lieu, quartier: a.quartier, commune: a.commune });
      if (futurVerrouille(a.date) && !(a.statut && verrou)) {
        // 3.25.0 : jour à venir sans « Saisie avancée » : pas de compte rendu, la planification reste possible
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Visite à venir.</b> Le compte rendu ne se saisit pas à l\'avance.</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (passeVerrouille(a.date) && !(a.statut && verrou)) {
        h += '<div class="bandeau" style="margin-top:10px"><p><b>Jour passé.</b> La saisie des comptes rendus des jours passés est désactivée. ' +
          'Pour l\'activer : roue crantée › Avancé › « Saisie avancée ».</p></div>' +
          '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else if (!verrou) {
        h += rendreCompteRendu(a);
        var cf = conflitArret(a);
        h += a.hors ? '<div class="rangee-actions bas-carte"><button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>' :
          cf ? questionConflit(a, cf) : '<div class="rangee-actions bas-carte"><button class="bouton petit danger-doux" type="button" data-a="retirer" data-uid="' + a.uid + '">' + icone('fermer') + 'Retirer de la tournée</button>' +
          '<button class="bouton petit" type="button" data-a="quitterCarte">Quitter</button></div>';
      } else {
        h += '<div class="cr-enregistre">' +
          '<div class="tuiles-resume">' + resumeCompteRendu(a, true) + '</div>' +
          '<div class="rangee-actions" style="margin:10px 0 0">' + (passeVerrouille(a.date) ? '' : '<button class="bouton petit" type="button" data-a="corriger" data-uid="' + a.uid + '">' + icone('crayon') + 'Modifier</button>') +
          '<button class="bouton petit avec-retour" type="button" data-a="quitterCarte">' + icone('chevron') + 'Quitter</button></div></div>';
      }
      h += '</div>';
    }
    return h + '</div></div></li>';
  }

  // ------------------------------------------------------------------ Couverture géographique
  function rendreCouverture(datesPlan) {
    var portee = S.ui.couvPortee, dates = portee === 'jour' ? [S.ui.jour] : joursOuvres(lundiDe(S.ui.jour));
    var mes = S.plan.filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var eq = arretsCollegues().filter(function (a) { return dates.indexOf(a.date) >= 0; });
    var cv = Moteur.couverture(ctx(), dates, mes, eq);
    var couv = cv.filter(function (c) { return c.moi > 0; }), non = cv.filter(function (c) { return c.moi === 0; });
    var ouverte = S.ui.couvOuverte;
    var h = '<section class="bloc couverture"><div class="couv-tete"><button type="button" class="groupe-bascule" data-a="couvOuvrir" aria-expanded="' + ouverte + '">' +
      '<b>Communes visitées</b><small>' + couv.length + '/' + cv.length + '</small>' + icone('chevron') + '</button>' +
      '<div class="segment petit" role="group" aria-label="Période">' +
        '<button type="button" data-a="couvPortee" data-v="jour" aria-pressed="' + (portee === 'jour') + '">Jour</button>' +
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '">Semaine</button></div></div>' +
      '<p class="discret" style="margin:0 0 8px">' + (portee === 'jour' ? majuscule(dateLongue(S.ui.jour)) : 'Semaine du ' + dateCourte(dates[0])) +
      ' : ' + couv.length + ' commune' + (couv.length > 1 ? 's' : '') + ' visitée' + (couv.length > 1 ? 's' : '') + ' sur ' + cv.length + '.</p>';
    if (!ouverte) return h + '<button type="button" class="bouton petit bouton-large" data-a="couvOuvrir">Voir la carte et les communes</button></section>';
    h += '<div class="carte-l" id="carteCouv">' + carteCouverture(dates, mes, eq) + '</div>' +
      '<div class="legende"><span><i class="q-moi"></i>Mes visites' + (portee === 'jour' ? ' (dans l\'ordre)' : '') + '</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Commune non visitée</span></div>';
    cartesAFaire.push({ id: 'carteCouv', route: portee === 'jour' ? mes : [], points: portee === 'jour' ? [] : mes, equipe: eq,
      nonCouvertes: non.map(function (c) { return c.commune; }) });
    h += segment('Filtre', 'couvFiltre', [['toutes', 'Toutes'], ['couvertes', 'Visitées · ' + couv.length], ['non', 'Non visitées · ' + non.length]], S.ui.couvFiltre);
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var zone = '';
    h += '<ul class="liste-couv">' + liste.map(function (c) {
      var t = '';
      if (c.zone !== zone) { zone = c.zone; t += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      return t + '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
        (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
        '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
    }).join('') + '</ul></section>';
    return h;
  }

  function carteCouverture(dates, mes, eq) {
    var qs = quartiers();
    if (!qs.length) return '';
    var minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    qs.forEach(function (q) { minLat = Math.min(minLat, q.lat); maxLat = Math.max(maxLat, q.lat); minLon = Math.min(minLon, q.lon); maxLon = Math.max(maxLon, q.lon); });
    var W = 360, H = Math.round(W * (maxLat - minLat) / (maxLon - minLon)) + 30, m = 18;
    function x(lon) { return m + (lon - minLon) / (maxLon - minLon) * (W - 2 * m); }
    function y(lat) { return m + (maxLat - lat) / (maxLat - minLat) * (H - 2 * m); }
    var parQ = {}, parQe = {};
    mes.forEach(function (a) { parQ[a.quartier] = (parQ[a.quartier] || 0) + 1; });
    eq.forEach(function (a) { parQe[a.quartier] = (parQe[a.quartier] || 0) + 1; });
    var centres = {};
    qs.forEach(function (q) { var c = centres[q.commune] = centres[q.commune] || { x: 0, y: 0, n: 0 }; c.x += x(q.lon); c.y += y(q.lat); c.n++; });
    var s = '<svg class="carte" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Carte de couverture des quartiers">';
    qs.forEach(function (q) {
      var n = parQ[q.quartier] || 0, ne = parQe[q.quartier] || 0;
      var cls = n ? 'q-moi' : (ne ? 'q-equipe' : 'q-vide');
      var r = n ? Math.min(4 + n * 1.6, 11) : (ne ? 4.5 : 3);
      s += '<circle class="' + cls + '" cx="' + x(q.lon).toFixed(1) + '" cy="' + y(q.lat).toFixed(1) + '" r="' + r.toFixed(1) + '"><title>' +
        esc(q.quartier + ', ' + q.commune + (n ? ' : ' + n + ' visite(s)' : '') + (ne ? ' ; équipe : ' + ne : '')) + '</title></circle>';
    });
    Object.keys(centres).forEach(function (k) {
      var c = centres[k];
      s += '<text x="' + (c.x / c.n).toFixed(1) + '" y="' + (c.y / c.n + 3).toFixed(1) + '">' + esc(k) + '</text>';
    });
    s += '</svg>';
    return s;
  }

  // ------------------------------------------------------------------ Cartes (Leaflet, fond OpenStreetMap épuré)
  // Chargée à la demande ; sans réseau, le schéma simplifié reste affiché.
  var cartesAFaire = [], promesseLeaflet = null;
  function chargerLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (promesseLeaflet) return promesseLeaflet;
    promesseLeaflet = new Promise(function (ok, ko) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = LEAFLET_CSS; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = LEAFLET_JS; js.onload = function () { ok(window.L); };
      js.onerror = function () { promesseLeaflet = null; ko(); }; document.head.appendChild(js);
    });
    return promesseLeaflet;
  }
  var LEAFLET_JS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
  var LEAFLET_CSS = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
  function couleur(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
  function themeSombre() { return document.documentElement.dataset.theme === 'sombre' || (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function dessinerCartes() {
    var l = cartesAFaire.slice();
    if (!l.length || !navigator.onLine) return;
    chargerLeaflet().then(function (L) { l.forEach(function (c) { dessinerCarte(L, c); }); }, function () {});
  }
  function dessinerCarte(L, c) {
    var el = $(c.id); if (!el) return;
    el.innerHTML = ''; el.classList.add('active');
    var carte = L.map(el, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    // fond OpenStreetMap (sans clé), adouci en CSS pour un rendu épuré (inversé en thème sombre)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© contributeurs OpenStreetMap' }).addTo(carte);
    el.classList.toggle('sombre', themeSombre());
    var prim = couleur('--primaire'), bleu = couleur('--bleu'), gris = couleur('--gris-2'), limites = [];
    // communes non couvertes : repère discret au centre de la commune
    var centres = {};
    quartiers().forEach(function (q) { var x = centres[q.commune] = centres[q.commune] || { lat: 0, lon: 0, n: 0 }; x.lat += +q.lat; x.lon += +q.lon; x.n++; });
    (c.nonCouvertes || []).forEach(function (k) {
      var x = centres[k]; if (!x) return;
      L.circle([x.lat / x.n, x.lon / x.n], { radius: 900, color: gris, weight: 1, dashArray: '4 4', fillOpacity: 0.06 }).addTo(carte).bindTooltip(k + ' : non visitée');
    });
    (c.equipe || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      L.circleMarker([p.lat, p.lon], { radius: 5, color: '#fff', weight: 1.5, fillColor: bleu, fillOpacity: 0.9 }).addTo(carte)
        .bindTooltip(esc(a.delegue || 'Équipe') + ' : ' + esc(a.nom));
      limites.push([p.lat, p.lon]);
    });
    var parQ = {};
    (c.points || []).forEach(function (a) {
      var p = coordArret(a); if (!p) return;
      var k = a.quartier || (p.lat + ',' + p.lon), x = parQ[k] = parQ[k] || { lat: p.lat, lon: p.lon, n: 0, lib: a.quartier };
      x.n++;
    });
    Object.keys(parQ).forEach(function (k) {
      var x = parQ[k];
      L.circleMarker([x.lat, x.lon], { radius: Math.min(6 + x.n * 2, 18), color: '#fff', weight: 2, fillColor: prim, fillOpacity: 0.85 }).addTo(carte)
        .bindTooltip(esc(x.lib) + ' : ' + x.n + ' visite' + (x.n > 1 ? 's' : ''));
      limites.push([x.lat, x.lon]);
    });
    var trace = [];
    (c.route || []).forEach(function (a, i) {
      var p = a.lat !== undefined && a.lat !== null && a.lat !== '' ? { lat: +a.lat, lon: +a.lon } : coordArret(a); if (!p) return;
      trace.push([p.lat, p.lon]); limites.push([p.lat, p.lon]);
      L.marker([p.lat, p.lon], { icon: L.divIcon({ className: 'pin', html: '<span>' + (i + 1) + '</span>', iconSize: [26, 26], iconAnchor: [13, 13] }) }).addTo(carte)
        .bindTooltip((heureVisite(a) ? heureVisite(a) + ' · ' : '') + esc(a.nom) + (a.lieu ? '<br>' + esc(a.lieu) : ''));
    });
    if (trace.length > 1) L.polyline(trace, { color: prim, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(carte);
    if (limites.length) carte.fitBounds(limites, { padding: [24, 24], maxZoom: 15 });
    else carte.setView([5.345, -4.01], 11);
  }
  function coordArret(a) {
    if (a.lat && a.lon) return { lat: +a.lat, lon: +a.lon };
    var cr = a.idPresence && ctx().parCode[a.code] ? ctx().parCode[a.code].filter(function (x) { return String(x.idPresence) === String(a.idPresence); })[0] : null;
    if (cr && cr.coord) return cr.coord;
    var q = quartiers().filter(function (x) { return x.quartier === a.quartier; })[0];
    return q ? { lat: +q.lat, lon: +q.lon } : null;
  }

  // ------------------------------------------------------------------ Vue : produits (aide-mémoire du délégué)
  // Fiches de la feuille « Fiches produits » du Google Sheet (repli : fiches intégrées), regroupées par gamme.
  var ORDRE_AIRES = ['Hypertension artérielle', 'Hypertension et cœur', 'Cholestérol et risque cardiovasculaire', 'Troubles du rythme cardiaque', 'Angine de poitrine', 'Prévention de la thrombose', 'Métabolisme et neuropathie'];
  var SECTIONS_FICHE = [['indications', 'Indications', 'ind'], ['contreIndications', 'Contre-indications', 'ci'], ['posologie', 'Posologie', 'pos'],
    ['precautions', 'Précautions et interactions', 'pre'], ['effets', 'Effets indésirables', 'ei'], ['arguments', 'Arguments clés pour la visite', 'arg']];
  function fichesProduits() { var l = (S.data && S.data.fiches) || []; return l.length ? l : FICHES_PRODUITS_DEFAUT; }
  function lignesFiche(t) { return String(t || '').split(/\n|;\s*(?=[A-ZÉÈÀÂÎÔ])/).map(function (x) { return x.replace(/^[•\-\s]+/, '').trim(); }).filter(Boolean); }
  // Disposition compacte : une ligne par gamme (nom, molécule) avec ses produits en pastilles ; un filtre par aire thérapeutique.
  // La fiche ne s'ouvre qu'au toucher d'un produit, dans une fenêtre ; ses rubriques secondaires se déplient à la demande.
  var AIRES_COURTES = { 'Hypertension artérielle': 'Hypertension', 'Cholestérol et risque cardiovasculaire': 'Cholestérol', 'Troubles du rythme cardiaque': 'Rythme', 'Prévention de la thrombose': 'Antiagrégant', 'Angine de poitrine': 'Angor', 'Métabolisme et neuropathie': 'Métabolisme' };
  function gammesProduits(l) {
    var g = [];
    l.forEach(function (f) { var x = g.filter(function (y) { return y.nom === f.gamme; })[0]; if (!x) g.push(x = { nom: f.gamme, aire: f.aire, fiches: [] }); x.fiches.push(f); });
    return g.sort(function (a, b) { var i = ORDRE_AIRES.indexOf(a.aire), j = ORDRE_AIRES.indexOf(b.aire); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
  }
  VUES.produits = function () {
    var q = normaliser(S.ui.rechProduit || ''), aire = S.ui.aireProduit || '', toutes = fichesProduits();
    var aires = []; toutes.forEach(function (f) { if (f.aire && aires.indexOf(f.aire) < 0) aires.push(f.aire); });
    aires.sort(function (a, b) { return ORDRE_AIRES.indexOf(a) - ORDRE_AIRES.indexOf(b); });
    var l = toutes.filter(function (f) { return (!aire || f.aire === aire) && (!q || normaliser([f.produit, f.dci, f.gamme, f.classe, f.indications, f.aire].join(' ')).indexOf(q) >= 0); });
    var h = '<h2 class="titre-vue">Produits</h2><p class="sous-titre">Aide-mémoire de visite : touchez un produit pour ouvrir sa fiche.</p>' +
      '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechProduit" placeholder="Produit, molécule, indication…" value="' + esc(S.ui.rechProduit || '') + '" aria-label="Rechercher un produit"></div></div>' +
      '<div class="defile" role="group" aria-label="Aire thérapeutique"><button type="button" class="puce" data-a="aireProduit" data-v="" aria-pressed="' + !aire + '">Tous</button>' +
      aires.map(function (x) { return '<button type="button" class="puce" data-a="aireProduit" data-v="' + esc(x) + '" aria-pressed="' + (aire === x) + '">' + esc(AIRES_COURTES[x] || x) + '</button>'; }).join('') + '</div>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun produit</strong>Aucune fiche ne correspond.</div>';
    // 3.19.0 : une section repliable par aire thérapeutique (ouverte d'office si un filtre ou une recherche est actif)
    // 3.22.3 : par défaut, seule la première aire est dépliée (le reste se déplie au toucher)
    if (!S.ui.airesOuvertes) { S.ui.airesOuvertes = {}; if (aires[0]) S.ui.airesOuvertes[aires[0]] = true; }
    var aireCourante = null, ouvertes = S.ui.airesOuvertes, toutOuvert = !!(aire || q);
    var parAire = {}; l.forEach(function (f) { parAire[f.aire] = (parAire[f.aire] || 0) + 1; });
    h += '<div class="liste-gammes">';
    gammesProduits(l).forEach(function (g) {
      if (g.aire !== aireCourante) {
        aireCourante = g.aire;
        var ouv = toutOuvert || ouvertes[g.aire];
        h += '<button type="button" class="aire-titre aire-bascule" data-a="aireBascule" data-v="' + esc(g.aire || '') + '" aria-expanded="' + !!ouv + '"><span>' + esc(g.aire || '') +
          '</span><small>' + parAire[g.aire] + ' produit' + (parAire[g.aire] > 1 ? 's' : '') + '</small>' + icone('chevron') + '</button>';
      }
      if (!(toutOuvert || ouvertes[g.aire])) return;
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, ''), mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      h += '<div class="ligne-gamme"><div class="lg-tete"><b>' + esc(nom) + '</b>' + (mol ? '<small>' + esc(mol) + '</small>' : '') + '</div><div class="lg-produits">' +
        g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).map(function (f) {
          // dans la ligne de la gamme, le nom de gamme n'est pas répété : « Rozukaa 10 » devient « 10 mg », « Zyltan AM » devient « AM »
          var court = f.produit.indexOf(nom + ' ') === 0 ? f.produit.slice(nom.length + 1) : f.produit;
          if (/^\d+$/.test(court)) court += ' mg';
          if (g.fiches.length === 1) court = f.produit;   // gamme d'un seul produit : nom complet (« Myonit SR » plutôt que « SR »)
          return '<button type="button" class="pastille-produit" data-a="produitOuvrir" data-v="' + esc(f.produit) + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') + '</div></div>';
    });
    return h + '</div><p class="discret" style="margin-top:12px;font-size:12.5px">Résumé des notices officielles des molécules ; la notice de la boîte fait foi. Fiches modifiables dans l\'onglet « Fiches produits » du Google Sheet.</p>';
  };
  // champ de recherche libre, identique à celui de l'onglet Recherche (loupe, sans critère à choisir)
  function champRechercheLibre(f, q) {
    return '<div class="recherche recherche-libre">' + icone('loupe') + '<input type="search" data-f="' + f + '" placeholder="Nom, spécialité, établissement, commune…" value="' +
      esc(q || '') + '" aria-label="Rechercher un praticien" autocomplete="off"></div>';
  }
  // 3.25.1 : résultats de la recherche libre d'« Autour de moi » : praticiens présents ce jour-là, tous rayons confondus,
  // selon les filtres appliqués, du plus proche au plus loin
  function momentAutour() {
    var A = S.ui.autour;
    if (A.moment === 'maintenant') return { date: aujourdhui(), minute: minutesMaintenant() };
    return { date: A.date || prochainJourOuvre(aujourdhui()), minute: heureVersMinutes(A.heure) };
  }
  function resultatsAutourLibre(q) {
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.resAutourLibre = [];
    if (!mots.length) return '';
    var A = S.ui.autour, m = momentAutour(), date = m.date;
    if (jourSemaineIndex(date) > 4) return '<p class="discret">Aucun praticien présent le week-end.</p>';
    var fa = S.ui.filtresAutour, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    var avecPos = A.lat !== null, pos = avecPos ? { lat: A.lat, lon: A.lon } : { lat: 5.345, lon: -4.02 };
    var dansT = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var l = Moteur.autourDe(ctx(), pos, date, m.minute, Infinity).filter(function (x) {
      var c = x.c, p = c.prat;
      if ((A.ref && c.code === A.ref.code) || (filtre && !filtre[c.code]) || absentLe(p, date) || dansT[c.code]) return false;
      var txt = normaliser([p.nom, p.specialite, c.lieu, c.quartier, c.commune].join(' '));
      return mots.every(function (w) { return txt.indexOf(w) >= 0; });
    });
    if (!avecPos) l.sort(function (a, b) { return b.score - a.score; });
    l = l.slice(0, 30); S.ui.resAutourLibre = l;
    if (!l.length) return '<p class="discret">Aucun praticien présent le ' + dateFr(date) + ' ne correspond, selon vos filtres.</p>';
    return '<p class="discret">' + l.length + (l.length === 30 ? '+' : '') + ' résultat' + (l.length > 1 ? 's' : '') + ', ' + dateLongue(date) + (avecPos ? ', du plus proche au plus loin' : '') + '.</p>' +
      '<ul class="liste">' + l.map(function (x, i) { return rendreProposition(x, i, date, 'libre', avecPos); }).join('') + '</ul>';
  }

  // ------------------------------------------------------------------ Vue : autour de moi
  VUES.autour = function () {
    var A = S.ui.autour, h = '<button type="button" class="retour" data-a="nav" data-tab="jour">' + icone('chevron') + 'Journée</button>' +
      '<h2 class="titre-vue">' + (S.ui.pharmaciesProches ? (S.ui.pharmaciesProches === 'Médecin' ? 'Médecins' : 'Pharmacies') + ' à proximité' : 'Autour de moi') + '</h2>' +
      '<p class="sous-titre">' + (S.ui.pharmaciesProches === 'Médecin' ? 'Les médecins présents près de votre position, selon vos spécialités, à ajouter à votre tournée du jour.' : S.ui.pharmaciesProches ? 'Les pharmacies ouvertes près de votre position, à ajouter à votre tournée du jour.' : 'Médecin absent, trou dans la journée : trouvez qui est présent près de vous.') + '</p>';
    if (A.ref) {
      h += '<div class="bandeau"><p>Remplacement de <b>' + esc(A.ref.nom) + '</b> (' + esc(A.ref.heure) + ', ' + esc(A.ref.quartier) +
        '), marqué « Absent ». <button type="button" class="bouton-texte" data-a="finRef">Terminer</button></p></div>';
    }
    // 3.25.1 : recherche libre en tête, sans critère à choisir (nom, spécialité, établissement, quartier, commune), dès les premières lettres
    var qL = S.ui.rechAutourLibre || '';
    var haut = h + champRechercheLibre('rechAutourLibre', qL) +
      '<div id="resAutourLibre">' + resultatsAutourLibre(qL) + '</div>';
    h = '';
    var fin = function (x) { return haut + '<div id="autourListe"' + (normaliser(qL) ? ' hidden' : '') + '>' + x + '</div>'; };
    var parCommune = {};
    quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
    if (S.ui.pharmaciesProches) {
      // raccourci « Pharmacie » : juste la position et le rayon, les résultats tout de suite
      h += '<section class="bloc compact"><p style="margin:0 0 10px"><b>' + esc(A.label || 'Position en cours de recherche…') + '</b></p>' +
        '<button class="bouton petit" type="button" data-a="localiser" style="margin-bottom:10px">' + icone('cible') + 'Actualiser ma position</button>' +
        segment('Rayon', 'autourRayon', RAYONS.map(function (r) { return [String(r), String(r).replace('.', ',') + ' km']; }), String(A.rayon), 'margin:0') + '</section>';
    } else {
    h += '<section class="bloc">' +
      '<div class="segment" role="group" aria-label="Moment">' +
        '<button type="button" data-a="autourMoment" data-v="maintenant" aria-pressed="' + (A.moment === 'maintenant') + '">Maintenant</button>' +
        '<button type="button" data-a="autourMoment" data-v="choisir" aria-pressed="' + (A.moment === 'choisir') + '">Autre moment</button></div>' +
      (A.moment === 'choisir' ? '<div class="grille-2"><label class="champ"><span>Date</span><input type="date" data-f="autour" data-k="date" value="' + esc(A.date || prochainJourOuvre(aujourdhui())) + '"></label>' +
        '<label class="champ"><span>Heure (vide : toute la journée)</span><input type="time" data-f="autour" data-k="heure" value="' + esc(A.heure) + '"></label></div>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="localiser" style="margin-bottom:10px">' + icone('cible') + 'Utiliser ma position</button>' +
      '<div class="champ"><span>Ou choisir un quartier</span>' + selecteurListe('autourQuartier', { titre: 'Choisir un quartier', valeur: '', vide: A.label ? A.label : 'Choisir un quartier', sections: sectionsQuartiers(),
        appliquer: function (v) { var q = quartiers().filter(function (x) { return x.quartier === v; })[0]; if (q) { S.ui.autour.lat = q.lat; S.ui.autour.lon = q.lon; S.ui.autour.label = q.quartier; S.ui.autour.src = 'quartier'; LS.set('autour', S.ui.autour); } } }) + '</div>';
    h += '<div class="champ" style="margin:0"><span>Rayon</span>' + segment('Rayon', 'autourRayon', RAYONS.map(function (r) { return [String(r), String(r).replace('.', ',') + ' km']; }), String(A.rayon), 'margin:0') + '</div></section>';
    h += barreFiltres(S.ui.filtresAutour, '', true);
    }

    if (S.ui.localisation === true) return fin(h + '<div class="vide"><strong>Position en cours de mise à jour…</strong>Les résultats s\'affichent dès que votre position est recalculée.</div>');
    if (A.lat === null) return fin(h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>');
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return fin(h + '<div class="vide"><strong>Pas de présences le week-end</strong>Médecins et pharmacies sont affichés du lundi au vendredi. Choisissez « Autre moment » et un jour de semaine.</div>');
    }
    h += bandeauFeries([date]);
    var fa = S.ui.filtresAutour, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    // 3.25.8 : ceux déjà dans ma tournée ce jour-là sont omis
    var dansTournee = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; });
    S.ui.resAutour = res;
    var groupes = minute === null ? [['matin', 'Le matin'], ['soir', 'Le soir']] :
      [['present', 'Présents maintenant'], ['plustard', 'Plus tard dans la journée']];
    h += '<p class="discret">' + majuscule(dateLongue(date)) + (minute !== null ? ', ' + minutesVersHeure(minute) : '') +
      ', autour de ' + esc(A.label || 'votre position') + (A.src === 'gps' && A.prec ? ' (précision ± ' + A.prec + ' m)' : '') + ' : ' + res.length + (S.ui.filtresAutour.type === 'Pharmacie' ? ' pharmacie' : (S.ui.filtresAutour.type === 'Médecin' ? ' médecin' : ' praticien')) + (res.length > 1 ? 's' : '') + '.</p>';
    groupes.forEach(function (g) {
      var l = res.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.etat === g[0]; });
      h += '<h3>' + g[1] + ' (' + l.length + ')</h3>';
      if (!l.length) { h += '<p class="discret">Aucun ' + (S.ui.pharmaciesProches === 'Pharmacie' ? 'pharmacie' : 'praticien') + ' dans ce rayon.</p>'; return; }
      h += '<ul class="liste">' + l.slice(0, 25).map(function (o) { return rendreProposition(o.x, o.i, date); }).join('') + '</ul>';
    });
    // 3.25.10 : rien dans le rayon : les plus proches au-delà, pour ne jamais laisser la page vide
    if (!res.length) {
      var plus = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, Infinity)
        .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; }).slice(0, 5);
      var base = S.ui.resAutour.length;
      S.ui.resAutour = S.ui.resAutour.concat(plus);
      if (plus.length) h += '<h3>Les plus proches, au-delà de ' + String(A.rayon).replace('.', ',') + ' km</h3><ul class="liste">' + plus.map(function (x, k) { return rendreProposition(x, base + k, date); }).join('') + '</ul>';
    }
    if (A.ref) {
      var autres = (ctx().parCode[A.ref.code] || []).filter(function (c) { return c.cle !== A.ref.cle; });
      h += '<h3>Autres présences de ' + esc(A.ref.nom) + '</h3>';
      h += autres.length ? '<ul class="liste">' + autres.map(function (c) {
        var d = prochaineOccurrence(c.jourIdx, A.ref.date, c.creneau === 'Soir' && A.ref.creneau === 'Matin');
        return '<li class="element"><div class="element-tete"><div><b>' + esc(c.jour) + ' ' + c.creneau.toLowerCase() + '</b>, ' +
          minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '<span class="discret bloc-texte">' + esc(c.lieu) + ', ' + esc(c.quartier) + '</span></div></div>' +
          '<button class="bouton bouton-large" type="button" data-a="planifierCle" data-v="' + esc(c.cle) + '" data-d="' + d + '">Planifier le ' + dateCourte(d) + '</button></li>';
      }).join('') + '</ul>' : '<p class="discret">Pas d\'autre présence connue.</p>';
    }
    return fin(h);
  };

  function prochaineOccurrence(jourIdx, depuis, memeJourPossible) {
    var delta = jourIdx - jourSemaineIndex(depuis);
    if (delta < 0 || (delta === 0 && !memeJourPossible)) delta += 7;
    return ajouterJours(depuis, delta);
  }

  // 3.18.0 : type de praticien en couleur (médecin bleu, pharmacie violet), avec le mot pour ne pas dépendre de la couleur
  function estPharmacie(o) { var t = o && (o.type || (praticien(o.code) || {}).type); return t === 'Pharmacie'; }
  // 3.23.1 : le type se lit par un symbole et une couleur : caducée du médecin (bâton d'Asclépios, bleu),
  // coupe d'Hygie de la pharmacie (violet) ; le mot reste lu par les lecteurs d'écran
  function pastilleType(o, grand) {
    var ph = estPharmacie(o), lib = ph ? 'Pharmacie' : 'Médecin';
    return '<i class="type-pastille ' + (ph ? 't-pharma' : 't-med') + (grand ? ' grand' : '') + '" role="img" aria-label="' + lib + '" title="' + lib + '">' + icone(ph ? 'pharmacie' : 'medecin') + '</i>';
  }
  // 3.23.4 : pas de doublon sous le titre : le lieu n'est pas répété quand c'est le nom (pharmacies),
  // et « Pharmacien » n'est pas écrit (le symbole de la pharmacie le dit)
  function lieuAffiche(a) {
    var l = normaliser(nomSansType(a.lieu)), n = normaliser(nomSansType(a.nom));
    return !l || l === n || n.indexOf(l) >= 0 || l.indexOf(n) >= 0 ? '' : a.lieu;
  }
  // sous-titre sans redite : pas de spécialité pour une pharmacie, rien de ce que le nom dit déjà
  function infosSansDoublon(o, l) {
    var n = normaliser(nomSansType(o.nom)), ph = estPharmacie(o), vus = {};
    return l.filter(function (x, i) {
      if (!x || (i === 0 && ph && x === o.specialite)) return false;
      var k = normaliser(nomSansType(x));
      if (!k || vus[k] || n.indexOf(k) >= 0 || k.indexOf(n) >= 0) return false;
      vus[k] = true; return true;
    }).join(', ');
  }
  function lieuQuartier(a) {
    var n = normaliser(a.nom), q = a.quartier && n.indexOf(normaliser(a.quartier)) >= 0 ? '' : a.quartier;
    return [lieuAffiche(a), q].filter(Boolean).join(', ');
  }
  function lieuEtSpec(a) { return [estPharmacie(a) ? '' : a.specialite, lieuAffiche(a)].filter(Boolean).join(', '); }
  function nomSansType(nom) { return String(nom || '').replace(/^\s*pharmacie\s+/i, ''); }
  function metres(km) { return Math.max(10, Math.round(km * 100) * 10) + ' mètres'; }
  function classeType(o) { return estPharmacie(o) ? ' t-pharma' : ' t-med'; }
  function rendreProposition(x, i, date, src, avecDist) {
    var c = x.c, p = c.prat;
    var deja = S.plan.some(function (a) { return a.date === date && a.code === p.code; });
    return '<li class="element' + classeType(p) + '"><div class="element-tete"><div>' +
      '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
      '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, c.lieu])) + '</span>' +
      '<span class="discret bloc-texte">' + esc(c.quartier) + ', ' + c.creneau.toLowerCase() + ' ' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + '</span>' +
      '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, date)) + '</span>' +
      etiquetteCollegues(p.code, date) + '</span></div>' +
      '<div class="element-mesure">' + (avecDist === false ? '' : (c.coord && c.coord.approx ? '≈ ' : '') + distanceCourte(x.dist)) +
        (avecDist !== false && c.coord && c.coord.approx ? '<small>quartier</small>' : '') + '<small>score ' + Math.round(x.score) + '</small></div></div>' +
      (avecDist !== false && c.coord && gpsPrecis() && (c.coord.approx || x.dist <= 2.5) ? '<p class="discret pos-approx">' + (c.coord.approx ? 'Position du lieu non enregistrée (centre du quartier). ' : 'Vous êtes devant mais la distance est fausse ? ') +
        '<button type="button" class="bouton-texte" data-a="posLieuIci" data-v="' + esc(c.cle) + '">' + icone('cible') + 'Je suis devant : enregistrer sa position</button></p>' : '') +
      (deja ? '<p class="discret" style="margin:8px 0 0">Déjà dans votre tournée ce jour-là.</p>' :
        '<div class="rangee" style="margin-top:10px"><a class="bouton" href="' + lienCarte({ lat: c.coord && c.coord.lat, lon: c.coord && c.coord.lon }) + '" target="_blank" rel="noopener">' + icone('carte') + 'Y aller</a>' +
        '<button class="bouton bouton-plein" type="button" data-a="ajouterAutour" data-i="' + i + '"' + (src ? ' data-s="' + src + '"' : '') + ' data-d="' + date + '">' + icone('plus') + (date === aujourdhui() ? 'Aujourd\'hui' : dateCourte(date)) + '</button></div>') +
      '</li>';
  }

  // ------------------------------------------------------------------ Vue : équipe (moi et mes collègues, jour ou semaine au choix)
  // Planifié : tournées (téléphone pour moi, feuille Plannings pour tous) ; fait : comptes rendus (Historique et file d'envoi)
  function donneesEquipe(dates) {
    var dd = ensemble(dates), nomMoi = moi() || 'Moi', l = [], cles = {};
    var hist = (S.queue || []).concat((S.data && S.data.historique) || []), parUid = {};
    hist.forEach(function (v) { if (v.uid && !parUid[v.uid]) parUid[v.uid] = v; });
    var miennesLocales = ensemble(S.plan.map(function (a) { return a.date; }));
    function ajouter(x) {
      var k = (x.delegue || '') + '|' + x.date + '|' + x.code;
      if (cles[k]) return; cles[k] = true; l.push(x);
    }
    S.plan.forEach(function (a) {
      if (!dd[a.date]) return;
      var v = parUid[a.uid];
      ajouter(Object.assign({}, a, { delegue: nomMoi, programme: jourConfirme(a.date) ? 'Validé' : 'Proposition',
        statut: v ? v.statut : (a.etat === 'valide' ? a.statut : ''), compte: v ? v : (a.etat === 'valide' ? a : null) }));
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (!dd[p.date] || !p.delegue) return;
      if (estMoi(p.delegue) && miennesLocales[p.date]) return;   // ma version du téléphone est la plus récente
      var v = p.uid ? parUid[p.uid] : null, st = v ? v.statut : (p.statut === 'À faire' ? '' : p.statut);
      ajouter(Object.assign({}, p, { delegue: estMoi(p.delegue) ? nomMoi : p.delegue, statut: st || '', compte: v || null }));
    });
    // visites faites hors tournée publiée (ajouts, anciennes tournées)
    hist.forEach(function (v) {
      var d = String(v.date || '').slice(0, 10);
      if (!dd[d] || !v.delegue) return;
      var x = Object.assign({}, v, { date: d, delegue: estMoi(v.delegue) ? nomMoi : v.delegue, heure: '', programme: '', compte: v, horsTournee: true });
      ajouter(x);
    });
    return l;
  }
  function decalerEquipe(sens) {
    var p = S.ui.eqPortee, d = S.ui.eqDate || aujourdhui();
    S.ui.eqDate = ajouterJours(d, (p === 'semaine' ? 7 : 1) * sens);
    if (p === 'jour') { while (jourSemaineIndex(S.ui.eqDate) > 4) S.ui.eqDate = ajouterJours(S.ui.eqDate, sens); }
    S.ui.jourEquipe = null; LS.set('eqDate', S.ui.eqDate); rendre();
  }

  VUES.equipe = function () {
    var nomMoi = moi() || 'Moi', p = S.ui.eqPortee || 'semaine', ref = S.ui.eqDate || aujourdhui();
    var dates = p === 'semaine' ? joursOuvres(lundiDe(ref)) : [ref];
    var h = '<h2 class="titre-vue">Équipe</h2>' + barreQuiQuand('equipe') +
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
    var visibles = tous ? noms : sel;
    h += '<ul class="liste resume-equipe">' + visibles.map(function (n) { return ligne(n, tout.filter(function (x) { return x.delegue === n; })); }).join('') + '</ul>';

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
          '<div><div class="arret-carte"><span class="arret-nom">' + esc(x.nom) + ' ' + etoiles(x.note) + '</span>' +
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
      if (f.communes.length && !lieux.some(function (x) { return co[x.commune]; })) return false;
      if (f.visite !== 'tous') {
        var j = p.derniere ? joursEcoules(p.derniere, t) : Infinity;
        if (f.visite === '30' && j <= 30) return false;
        if (f.visite === 'recent' && j > 30) return false;
        if (f.visite === 'jamais' && p.derniere) return false;
        if (f.visite === 'retard' && j < REGLAGES_MOTEUR.cadence[p.note]) return false;
        if (f.visite === 'revoir' && !aRevoir(p)) return false;
      }
      if (f.equipe !== 'tous' && (f.equipe === 'oui') !== (cibleParCollegues(p.code, t).length > 0)) return false;
      if (!q) return true;
      var l = lieux.map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
      return normaliser(p.nom + ' ' + p.specialite + ' ' + p.code + ' ' + l).indexOf(q) >= 0;
    });
  }
  var LIB_VISITE = { '30': 'Non visité depuis +30 j', recent: 'Visité il y a moins de 30 j', jamais: 'Jamais visité',
                     retard: 'En retard sur la cadence', revoir: 'À revoir' };
  // Liste des critères actifs : [clé, valeur, libellé]
  function criteresActifs(f) {
    var l = [];
    if (f.type !== 'tous') l.push(['type', f.type, f.type === 'Pharmacie' ? 'Pharmacies' : 'Médecins']);
    f.potentiels.forEach(function (x) { l.push(['potentiels', x, ETOILES[x]]); });
    if (f.type !== 'Pharmacie') f.specialites.forEach(function (x) { l.push(['specialites', x, x]); });
    f.communes.forEach(function (x) { l.push(['communes', x, x]); });
    if (f.visite !== 'tous') l.push(['visite', f.visite, LIB_VISITE[f.visite]]);
    if (f.conv !== 'tous') l.push(['conv', f.conv, f.conv === 'oui' ? 'Engagés' : 'Non engagés']);
    if (f.equipe !== 'tous') l.push(['equipe', f.equipe, f.equipe === 'oui' ? 'Ciblés par l\'équipe' : 'Non ciblés par l\'équipe']);
    return l;
  }
  var FILTRES_RAPIDES = [['potentiels', 'A', '★★★'], ['visite', '30', 'Non visité +30 j'], ['visite', 'revoir', 'À revoir'],
                         ['visite', 'jamais', 'Jamais visité'], ['conv', 'oui', 'Engagés']];
  function estRapide(k, v) { return FILTRES_RAPIDES.some(function (x) { return x[0] === k && x[1] === v; }); }
  function filtreRapideActif(f, k, v) { return Array.isArray(f[k]) ? f[k].indexOf(v) >= 0 : f[k] === v; }
  function trierPraticiens(liste, tri) {
    var t = aujourdhui();
    return liste.sort(function (a, b) {
      if (tri === 'nom') return a.nom.localeCompare(b.nom, 'fr');
      if (tri === 'retard') return joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t) || b.note - a.note;
      if (tri === 'score') return calcScore(b.note, joursEcoules(b.derniere, t), b.statut) - calcScore(a.note, joursEcoules(a.derniere, t), a.statut);
      return b.note - a.note || joursEcoules(b.derniere, t) - joursEcoules(a.derniere, t);
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
  function etapesFiltres(f) {
    var vis = [['tous', 'Toutes'], ['jamais', 'Jamais visité'], ['30', 'Non visité +30 j'], ['retard', 'En retard sur la cadence'], ['revoir', 'À revoir'], ['recent', 'Vu il y a moins de 30 j']];
    var l = [
      { id: 'qui', auto: true, resume: function () { return f.type === 'Pharmacie' ? 'Pharmacies' : (f.type === 'Médecin' ? 'Médecins' : 'Médecins et pharmacies'); },
        rendu: function () {
          return '<div class="puces">' + [['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']].map(function (x) { return puceEtape('type', x[0], x[1], f.type === x[0], false, 'qui'); }).join('') + '</div>' +
            '<p class="discret raccourcis-titre-etape">Ou directement un raccourci :</p><div class="puces">' + FILTRES_RAPIDES.map(function (x) {
              return '<button type="button" class="puce petite" data-a="filtreRapide" data-fin="1" data-k="' + x[0] + '" data-v="' + x[1] + '" aria-pressed="' + filtreRapideActif(f, x[0], x[1]) + '">' + esc(x[2]) + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'spec', si: f.type !== 'Pharmacie', resume: function () { return f.specialites.length ? f.specialites.join(', ') : 'Toutes'; },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + (f.specialites.length ? esc(f.specialites.join(', ')) : 'Toutes les spécialités') + (f.type === 'tous' ? ' (les pharmacies restent affichées)' : '') + '</p>' +
            '<button class="bouton petit" type="button" data-a="filtreQuestion" data-v="spec">' + icone('loupe') + 'Choisir les spécialités</button>';
        } },
      { id: 'com', resume: function () { return f.communes.length ? f.communes.join(', ') : 'Toutes'; },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + (f.communes.length ? esc(f.communes.join(', ')) : 'Toutes les communes') + '</p>' +
            '<button class="bouton petit" type="button" data-a="filtreQuestion" data-v="com">' + icone('loupe') + 'Choisir les communes</button>';
        } },
      { id: 'valeur', resume: function () {
          var r = f.potentiels.map(function (x) { return ETOILES[x]; }); if (f.conv !== 'tous') r.push(f.conv === 'oui' ? 'Engagés' : 'Non engagés');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Potentiel</span><div class="puces">' + [['A', '★★★ fort'], ['B', '★★ moyen'], ['C', '★ faible']].map(function (x) { return puceEtape('potentiels', x[0], x[1], f.potentiels.indexOf(x[0]) >= 0, true); }).join('') + '</div>' +
            '<span class="sous-etape">Engagé</span><div class="puces">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('conv', x[0], x[1], f.conv === x[0]); }).join('') + '</div>';
        } },
      { id: 'suivi', resume: function () {
          var r = []; if (f.visite !== 'tous') r.push(LIB_VISITE[f.visite]);
          if (f.equipe !== 'tous' && !S.config.demo) r.push(f.equipe === 'oui' ? 'Prévus par un collègue' : 'Non prévus par un collègue');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Dernière visite (un seul choix)</span><div class="puces">' + vis.map(function (x) { return puceEtape('visite', x[0], x[1], f.visite === x[0]); }).join('') + '</div>' +
            (S.config.demo ? '' : '<span class="sous-etape">Prévu par un collègue cette semaine</span><div class="puces">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('equipe', x[0], x[1], f.equipe === x[0]); }).join('') + '</div>');
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

  // Résumé des critères retenus, en une phrase (ex. « 12 médecins cardiologues à potentiel ★★★, non visités depuis plus de 30 jours, à Cocody, triés par potentiel. »)
  function phraseCriteres(f, q, n, tri) {
    var fem = f.type === 'Pharmacie', pl = n > 1, s = pl ? 's' : '', e = fem ? 'e' : '';
    var nom = f.type === 'Pharmacie' ? 'pharmacie' : (f.type === 'Médecin' ? 'médecin' : 'praticien');
    var t = (n ? n : 'Aucun' + (fem ? 'e' : '')) + ' ' + nom + (pl ? 's' : '');
    if (f.type !== 'Pharmacie' && f.specialites.length) {
      t += ' ' + f.specialites.map(function (x) { var m = x.toLowerCase(); return pl && !/[sx]$/.test(m) ? m + 's' : m; }).join(' ou ');
      if (f.type === 'tous') t += ' (et les pharmacies)';
    }
    var c = [];
    if (f.potentiels.length) c.push('à potentiel ' + f.potentiels.map(function (x) { return ETOILES[x]; }).join(' ou '));
    if (f.conv !== 'tous') c.push((f.conv === 'oui' ? 'engagé' : 'non engagé') + e + s);
    var vis = { '30': 'non visité' + e + s + ' depuis plus de 30 jours', recent: 'visité' + e + s + ' il y a moins de 30 jours', jamais: 'jamais visité' + e + s,
                retard: 'en retard sur la cadence de visite', revoir: 'à revoir' };
    if (f.visite !== 'tous') c.push(vis[f.visite]);
    if (f.equipe !== 'tous') c.push((f.equipe === 'oui' ? 'déjà prévu' : 'non prévu') + e + s + ' par un collègue cette semaine');
    if (f.communes.length) c.push('à ' + f.communes.join(' ou '));
    if (q && String(q).trim()) c.push('correspondant à « ' + String(q).trim() + ' »');
    var lt = { priorite: 'par potentiel', score: 'par priorité de visite', retard: 'du plus longtemps sans visite au plus récent', nom: 'par nom' };
    if (n > 1 && lt[tri]) c.push('trié' + e + 's ' + lt[tri]);
    return t + (c.length ? ' ' + c.join(', ') : '') + '.';
  }

  VUES.praticiens = function () {
    var f = S.ui.filtres, t = aujourdhui(), c = ctx();
    var liste = trierPraticiens(filtrerPraticiens(f, S.ui.recherche), S.ui.tri);
    // la fiche ouverte (par exemple juste créée) reste en tête de liste
    var io = liste.map(function (p) { return p.code; }).indexOf(S.ui.contactOuvert);
    if (io > 0 && S.ui.contactEnTete === S.ui.contactOuvert) liste.unshift(liste.splice(io, 1)[0]);
    // 3.19.0 : les critères s'ouvrent sur une page à part (même onglet) ; dès les résultats affichés, ils disparaissent
    // au profit d'une phrase (nombre de praticiens et critères appliqués) et de « Tout effacer »
    if (S.ui.rechOuverte) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="rechFermer">' + icone('chevron') + 'Recherche</button>' +
        '<h2 class="titre-vue">Critères de recherche</h2><p class="sous-titre">Une question à la fois ; les résultats s\'affichent à la fin.</p>' +
        '<section class="bloc">' + barreFiltres(f, S.ui.recherche, true) + '</section>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="rechFermer">' + icone('loupe') + 'Voir ' + (liste.length ? 'les ' + liste.length + ' résultat' + (liste.length > 1 ? 's' : '') : 'les résultats') + '</button></div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Recherche</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="nouvelleFiche">' + icone('plus') + 'Ajouter</button></div>' +
      '<p class="sous-titre">Médecins et pharmacies : recherche, fiche, jours de présence et contact.</p>';
    h += '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(S.ui.recherche) + '" aria-label="Rechercher un praticien"></div></div>';
    h += '<button class="bouton bouton-large bouton-criteres" type="button" data-a="rechOuvrir">' + icone('filtre') + 'Rechercher par critères</button>';
    h += '<p class="phrase-criteres">' + esc(phraseCriteres(f, S.ui.recherche, liste.length, S.ui.tri)) + '</p>';
    if (criteresActifs(f).length || S.ui.recherche) h += '<div class="tri tri-centre"><button type="button" class="bouton-texte effacer-filtres" data-a="effacerFiltres">' + icone('fermer') + 'Réinitialiser les filtres et recommencer</button></div>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucun praticien</strong>Aucun praticien ne correspond à tous ces critères. Retirez un filtre.</div>';
    h += '<ul class="liste">';
    liste.slice(0, S.ui.limite).forEach(function (p) {
      var ouvert = S.ui.contactOuvert === p.code, lieux = c.presencesParCode[p.code] || [];
      h += '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="contact" data-v="' + esc(p.code) + '" aria-expanded="' + ouvert + '">' +
        '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        '<span class="discret bloc-texte">' + (estPharmacie(p) ? '' : esc(p.specialite) + ', ') + lieux.length + ' lieu' + (lieux.length > 1 ? 'x' : '') + ' : ' +
          esc(Array.from(new Set(lieux.map(function (x) { return x.commune; }))).join(', ')) + '</span>' +
        '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere)) + '</span>' +
        (p.statut ? '<span class="etiquette ' + (estKo(p.statut) ? 'ko' : 'ok') + '">' + esc(p.statut) + '</span>' : '') +
        (/^TMP-/.test(p.code) || ficheEnAttente(p.code) ? '<span class="etiquette p1">Fiche en attente d\'envoi</span>' : '') +
        etiquetteCollegues(p.code, t) + '</span></button>';
      if (ouvert) {
        var cr = (c.parCode[p.code] || [])[0], pres = lieux[0] || {};
        h += actionsRapides({ telephone: p.telephone, lat: cr && cr.coord && cr.coord.lat, lon: cr && cr.coord && cr.coord.lon,
                              lieu: pres.lieu, quartier: pres.quartier, commune: pres.commune });
        if (p.telephone) h += '<p class="discret" style="margin:8px 0 0">Téléphone : ' + esc(p.telephone) + '</p>';
        if (p.commentaire) h += '<p class="discret" style="margin:8px 0 0">Dernier commentaire : ' + esc(p.commentaire) + '</p>';
        if (p.prochaine) h += '<p class="discret" style="margin:4px 0 0">Prochain RDV le ' + dateCourte(p.prochaine) + '</p>';
        if (p.absentDu) h += '<p class="discret erreur-texte" style="margin:4px 0 0">Absent du ' + dateCourte(p.absentDu) + (p.absentAu ? ' au ' + dateCourte(p.absentAu) : '') + '</p>';
        h += grillePresences(p.code);
        var impose = S.imposes.some(function (im) { return im.code === p.code; });
        h += '<div class="rangee" style="margin-top:10px">' +
          (impose ? '<span class="etiquette p1">Prioritaire dans ma tournée</span>' :
            '<button class="bouton bouton-plein" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">' + icone('plus') + 'Ajouter à ma tournée</button>') +
          '<button class="bouton" type="button" data-a="modifierFiche" data-v="' + esc(p.code) + '">' + icone('crayon') + 'Modifier la fiche</button>' +
          '</div>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (liste.length > S.ui.limite) h += '<button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button>';
    return h;
  };

  // Planning hebdomadaire d'un praticien (lieux x jours)
  function grillePresences(code) {
    var c = ctx(), lieux = c.presencesParCode[code] || [];
    if (!lieux.length) return '<p class="discret">Aucune présence renseignée.</p>';
    var h = '<div class="grille-pres"><table><thead><tr><th>Lieu</th>' + JOURS.map(function (j) { return '<th>' + j.slice(0, 3) + '</th>'; }).join('') + '</tr></thead><tbody>';
    lieux.forEach(function (pr) {
      var hM = lireHoraire(pr.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      h += '<tr><td><b>' + esc(pr.lieu) + '</b><small>' + esc(pr.quartier) + ', ' + esc(pr.commune) + '<br>Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) +
        ', soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]) + '</small></td>' +
        JOURS_CLES.map(function (j, i) {
          var d = lireDispo(pr[j]);
          var t = d.matin && d.soir ? 'M S' : (d.matin ? 'M' : (d.soir ? 'S' : ''));
          if (!t) return '<td></td>';
          var cleM = pr.id + '|' + i + '|Matin', cleS = pr.id + '|' + i + '|Soir';
          return '<td class="dispo">' + (d.matin ? '<button type="button" data-a="planifierCle" data-v="' + esc(cleM) + '" title="Planifier ' + JOURS[i] + ' matin">M</button>' : '') +
            (d.soir ? '<button type="button" data-a="planifierCle" data-v="' + esc(cleS) + '" title="Planifier ' + JOURS[i] + ' soir">S</button>' : '') + '</td>';
        }).join('') + '</tr>';
    });
    return h + '</tbody></table><p class="discret">Touchez M (matin) ou S (soir) pour planifier une visite : prochaine présence ou les semaines suivantes.</p></div>';
  }

  // ------------------------------------------------------------------ Vue : statistiques
  // 3.21.0 : un seul filtre « Qui / Quand » pour le Bilan (tableau de bord et historique) et l'Équipe :
  // moi, toute l'équipe ou plusieurs délégués choisis ; jour, semaine, mois ou période, avec ‹ › pour avancer ou reculer
  var FEUILLES = {};   // feuilles (fenêtres) : déclarées ici car certaines sont définies plus haut que leur section
  S.ui.fq = LS.get('filtreQui', { qui: 'moi', liste: [] });
  function nomsDelegues() {
    var n = {}; ((S.data && S.data.delegues) || []).forEach(function (x) { n[x] = true; });
    ((S.data && S.data.plannings) || []).concat((S.data && S.data.historique) || []).forEach(function (x) { if (x.delegue) n[String(x.delegue).trim()] = true; });
    if (moi()) n[moi()] = true;
    return Object.keys(n).filter(Boolean).sort(function (a, b) { return estMoi(a) ? -1 : estMoi(b) ? 1 : a.localeCompare(b, 'fr'); });
  }
  function quiCorrespond(nom) {
    var f = S.ui.fq;
    if (f.qui === 'tous') return true;
    if (f.qui === 'liste') return f.liste.some(function (x) { return nom ? String(nom).trim().toLowerCase() === x.toLowerCase() : estMoi(x); });
    return !nom || estMoi(nom);
  }
  function libelleQui() {
    var f = S.ui.fq;
    if (f.qui === 'tous') return 'Toute l\'équipe';
    if (f.qui === 'liste') return f.liste.length > 2 ? f.liste.length + ' délégués' : f.liste.map(function (x) { return estMoi(x) ? 'Moi' : x.split(' ')[0]; }).join(', ');
    return 'Moi';
  }
  function libelleBornes(b) {
    var st = S.ui.stats;
    if (b[0] === b[1]) return majuscule(dateCourte(b[0]));
    if (st.periode === 'semaine') return 'Semaine du ' + dateCourte(b[0]);
    if (st.periode === 'mois') return majuscule(MOIS[+b[0].slice(5, 7) - 1]) + ' ' + b[0].slice(0, 4);
    return 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]);
  }
  function barreQuiQuand(onglet) {
    var quand = onglet === 'equipe' ? (S.ui.eqPortee === 'jour' ? majuscule(dateCourte(S.ui.eqDate || aujourdhui())) : 'Semaine du ' + dateCourte(lundiDe(S.ui.eqDate || aujourdhui()))) : libelleBornes(bornesStats());
    var nav = onglet === 'equipe' || S.ui.stats.periode !== 'perso';
    return '<div class="barre-qq">' +
      (S.config.demo ? '' : '<button type="button" class="puce-filtre" data-a="quiOuvrir">' + icone('equipe') + '<span>' + esc(libelleQui()) + '</span><b>▾</b></button>') +
      '<div class="qq-quand">' + (nav ? '<button type="button" class="bouton-icone sombre" data-a="quandDecaler" data-o="' + onglet + '" data-v="-1" aria-label="Période précédente">' + icone('chevron') + '</button>' : '') +
      '<button type="button" class="puce-filtre" data-a="quandOuvrir" data-o="' + onglet + '">' + icone('calendrier') + '<span>' + esc(quand) + '</span><b>▾</b></button>' +
      (nav ? '<button type="button" class="bouton-icone sombre suivant" data-a="quandDecaler" data-o="' + onglet + '" data-v="1" aria-label="Période suivante">' + icone('chevron') + '</button>' : '') + '</div></div>';
  }
  FEUILLES.qui = function (f) {
    var noms = nomsDelegues();
    return '<div class="segment" role="group" aria-label="Qui" style="margin-top:0">' + [['moi', 'Moi'], ['tous', 'Toute l\'équipe'], ['liste', 'Choisir']].map(function (x) {
        return '<button type="button" data-a="quiMode" data-v="' + x[0] + '" aria-pressed="' + (f.qui === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.qui === 'liste' ? '<p class="discret" style="margin:4px 0 8px">Touchez les délégués à réunir dans le bilan.</p><div class="puces">' + noms.map(function (n) {
        return '<button type="button" class="puce" data-a="quiToggle" data-v="' + esc(n) + '" aria-pressed="' + (f.liste.indexOf(n) >= 0) + '">' + esc(n) + (estMoi(n) ? ' (moi)' : '') + '</button>';
      }).join('') + '</div>' : '') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quiAppliquer" style="margin-top:14px">Appliquer</button>';
  };
  FEUILLES.quand = function (f) {
    var opts = f.onglet === 'equipe' ? [['jour', 'Jour'], ['semaine', 'Semaine']] : [['jour', 'Jour'], ['semaine', 'Semaine'], ['mois', 'Mois'], ['perso', 'Période']];
    return '<div class="segment" role="group" aria-label="Période" style="margin-top:0">' + opts.map(function (x) {
        return '<button type="button" data-a="quandMode" data-v="' + x[0] + '" aria-pressed="' + (f.periode === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.periode === 'perso' ? '<div class="grille-2"><label class="champ"><span>Du</span><input type="date" id="quandDebut" value="' + esc(f.debut) + '"></label>' +
        '<label class="champ"><span>Au</span><input type="date" id="quandFin" value="' + esc(f.fin) + '"></label></div>' :
        '<label class="champ"><span>' + (f.periode === 'mois' ? 'Un jour du mois' : f.periode === 'semaine' ? 'Un jour de la semaine' : 'Date') + '</span><input type="date" id="quandRef" value="' + esc(f.ref) + '"></label>') +
      '<button class="bouton bouton-plein bouton-large" type="button" data-a="quandAppliquer">Appliquer</button>';
  };
  function bornesStats() {
    var st = S.ui.stats, t = st.ref || aujourdhui();
    if (st.periode === 'jour') return [t, t];
    if (st.periode === 'semaine') { var l = lundiDe(t); return [l, ajouterJours(l, 6)]; }
    if (st.periode === 'mois') { var d = t.slice(0, 8) + '01'; return [d, ajouterJours(ajouterJours(d, 32).slice(0, 8) + '01', -1)]; }
    var a = st.debut || ajouterJours(t, -29), b = st.fin || t;
    return a <= b ? [a, b] : [b, a];
  }
  function joursEntre(a, b) { var l = []; for (var d = a; d <= b && l.length < 400; d = ajouterJours(d, 1)) l.push(d); return l; }
  // Comptes rendus connus (envoyés et en attente), sans doublon
  function visitesConnues() {
    var vus = {}, l = [];
    S.queue.concat((S.data && S.data.historique) || []).forEach(function (v) {
      if (v.uid) { if (vus[v.uid]) return; vus[v.uid] = true; }
      l.push(v);
    });
    return l;
  }
  // Visites planifiées : ma tournée en cours + tournées publiées (les miennes ou celles de toute l'équipe)
  function arretsPlanifies(equipe) {
    var vus = {}, l = [];
    S.plan.forEach(function (a) {
      vus[a.uid] = true;
      l.push({ date: a.date, code: a.code, commune: a.commune, specialite: a.specialite, statut: a.statut, etat: a.etat, delegue: moi() || 'Moi' });
    });
    ((S.data && S.data.plannings) || []).forEach(function (p) {
      if (vus[p.uid] || (!equipe && !estMoi(p.delegue))) return;
      vus[p.uid] = true; l.push(p);
    });
    return l;
  }
  function calculerStats() {
    var st = S.ui.stats, eq = S.ui.fq.qui !== 'moi' && !S.config.demo, b = bornesStats(), t = aujourdhui();
    var dans = function (d) { return d && d >= b[0] && d <= b[1]; };
    var visites = visitesConnues().filter(function (v) { return dans(String(v.date).slice(0, 10)) && (S.config.demo || quiCorrespond(v.delegue)); });
    var effectives = visites.filter(function (v) { return Moteur.estVisite(v.statut, statuts()); });
    var plan = arretsPlanifies(eq).filter(function (a) { return dans(a.date) && (S.config.demo || quiCorrespond(a.delegue)); });
    var echus = plan.filter(function (a) { return a.date <= t; });
    var faits = echus.filter(function (a) { return a.etat === 'valide' && Moteur.estVisite(a.statut, statuts()); });
    var delegues = {};
    if (eq) { plan.forEach(function (a) { if (a.delegue) delegues[a.delegue] = true; }); visites.forEach(function (v) { if (v.delegue) delegues[v.delegue] = true; }); }
    var nbDel = eq ? Math.max(1, Object.keys(delegues).length) : 1;
    var ouvres = joursEntre(b[0], b[1]).filter(function (d) { return jourSemaineIndex(d) < 5; }).length;
    var objectif = Math.round((+st.objectif || 0) / 5 * ouvres * nbDel);
    var prat = ctx().prat, nA = 0, nAok = 0;
    Object.keys(prat).forEach(function (k) {
      var p = prat[k]; if (p.note !== 3) return;
      nA++; if (joursEcoules(p.derniere, t) <= REGLAGES_MOTEUR.cadence[3]) nAok++;
    });
    return { bornes: b, equipe: eq, visites: visites, effectives: effectives, plan: plan, echus: echus, faits: faits,
             nbDel: nbDel, delegues: Object.keys(delegues).sort(), ouvres: ouvres, objectif: objectif, nA: nA, nAok: nAok };
  }
  function taux(a, b) { return b ? Math.round(100 * a / b) : null; }
  function txt(n) { return n === null || n === undefined ? 'n.d.' : n + ' %'; }

  VUES.bilan = function () {
    var vueH = S.ui.statsVue === 'historique';
    var tete = '<h2 class="titre-vue">Bilan</h2>' +
      segment('Affichage', 'statsVue', [['tableau', 'Tableau de bord'], ['historique', 'Historique']], vueH ? 'historique' : 'tableau') + barreQuiQuand('bilan');
    if (vueH) return tete + VUES.historique(true);
    var st = S.ui.stats, r = calculerStats(), b = r.bornes;
    var h = tete;
    h += '<p class="discret" style="margin:0 0 10px">' + (b[0] === b[1] ? majuscule(dateLongue(b[0])) : 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1])) +
      (r.equipe ? ', ' + r.nbDel + ' délégué' + (r.nbDel > 1 ? 's' : '') : ', mes visites') + '.</p>';

    var couv = taux(r.faits.length, r.echus.length), pres = taux(r.effectives.length, r.visites.length), att = taux(r.effectives.length, r.objectif);
    var aVenir = r.plan.length - r.echus.length;
    h += '<div class="kpis">' +
      kpi(txt(couv), 'Taux de réalisation', r.faits.length + ' faites sur ' + r.echus.length + ' prévues' + (aVenir > 0 ? ', ' + aVenir + ' à venir' : ''), couv) +
      kpi(String(r.effectives.length), 'Visites réalisées', r.visites.length + ' compte' + (r.visites.length > 1 ? 's' : '') + ' rendu' + (r.visites.length > 1 ? 's' : '') + ', présence ' + txt(pres)) +
      kpi(txt(att), 'Objectif atteint', r.effectives.length + ' / ' + r.objectif + ' visites (' + st.objectif + ' par semaine' + (r.equipe ? ' et par délégué' : '') + ')', att) +
      kpi(txt(taux(r.nAok, r.nA)), 'Praticiens ★★★ à jour', r.nAok + ' sur ' + r.nA + ' vus depuis moins de ' + REGLAGES_MOTEUR.cadence[3] + ' j', taux(r.nAok, r.nA)) +
      '</div>';

    // Activité dans le temps
    var jours = joursEntre(b[0], b[1]);
    if (jours.length > 1) {
      var parSemaine = jours.length > 35, groupes = [], idx = {};
      jours.forEach(function (d) {
        if (!parSemaine && jourSemaineIndex(d) > 4) return;
        var k = parSemaine ? lundiDe(d) : d;
        if (idx[k] === undefined) { idx[k] = groupes.length; groupes.push({ k: k, prevu: 0, fait: 0 }); }
      });
      r.plan.forEach(function (a) { var g = groupes[idx[parSemaine ? lundiDe(a.date) : a.date]]; if (g) g.prevu++; });
      r.effectives.forEach(function (v) { var d = String(v.date).slice(0, 10), g = groupes[idx[parSemaine ? lundiDe(d) : d]]; if (g) g.fait++; });
      var obj = (+st.objectif || 0) / 5 * r.nbDel * (parSemaine ? 5 : 1);
      h += '<section class="bloc"><h3>Activité ' + (parSemaine ? 'par semaine' : 'par jour') + '</h3>' + legende(true) +
        colonnes(groupes.map(function (g) {
          var lib = parSemaine ? 'Sem. ' + dateCourte(g.k).slice(5) : JOURS_COURTS[jourSemaineIndex(g.k)].charAt(0).toUpperCase() + (+g.k.slice(8));
          return { lib: lib, prevu: g.prevu, fait: g.fait, tip: (parSemaine ? 'Semaine du ' + dateCourte(g.k) : majuscule(dateLongue(g.k))) + ' : ' + g.fait + ' réalisée' + (g.fait > 1 ? 's' : '') + ', ' + g.prevu + ' planifiée' + (g.prevu > 1 ? 's' : '') };
        }), obj) +
        tableDonnees(['Période', 'Planifiées', 'Réalisées'], groupes.map(function (g) { return [parSemaine ? 'Sem. du ' + dateCourte(g.k) : dateCourte(g.k), g.prevu, g.fait]; })) +
        '</section>';
    }

    // Activité par commune
    var parCom = {};
    r.plan.forEach(function (a) { var c = a.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).prevu++; });
    r.effectives.forEach(function (v) { var c = v.commune || 'Non renseignée'; (parCom[c] = parCom[c] || { prevu: 0, fait: 0 }).fait++; });
    var coms = Object.keys(parCom).map(function (k) { return { lib: k, prevu: parCom[k].prevu, fait: parCom[k].fait }; })
      .sort(function (x, y) { return (y.prevu + y.fait) - (x.prevu + x.fait) || x.lib.localeCompare(y.lib, 'fr'); });
    h += '<section class="bloc"><h3>Activité par commune</h3>';
    if (!coms.length) h += '<p class="discret">Aucune visite planifiée ni réalisée sur la période.</p>';
    else {
      h += legende(false) + barres(coms.slice(0, 12).map(function (c) {
        return { lib: c.lib, piste: c.prevu, val: c.fait, etiquette: c.fait + ' / ' + c.prevu, tip: c.lib + ' : ' + c.fait + ' réalisée' + (c.fait > 1 ? 's' : '') + ' sur ' + c.prevu + ' planifiée' + (c.prevu > 1 ? 's' : '') };
      })) + (coms.length > 12 ? '<p class="discret">' + (coms.length - 12) + ' autre(s) commune(s) dans le tableau.</p>' : '') +
      tableDonnees(['Commune', 'Planifiées', 'Réalisées'], coms.map(function (c) { return [c.lib, c.prevu, c.fait]; }));
    }
    h += '</section>';

    // Répartition par spécialité
    var parSpec = {}, base = st.vueSpec !== 'visites';
    if (base) Object.keys(ctx().prat).forEach(function (k) { var p = ctx().prat[k]; if (p.type !== 'Pharmacie') parSpec[p.specialite || 'Autre'] = (parSpec[p.specialite || 'Autre'] || 0) + 1; });
    else r.effectives.forEach(function (v) { var k = v.specialite || 'Autre'; parSpec[k] = (parSpec[k] || 0) + 1; });
    var specs = Object.keys(parSpec).map(function (k) { return { lib: k, n: parSpec[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (specs.length > 9) { var autres = specs.slice(8).reduce(function (s2, x) { return s2 + x.n; }, 0); specs = specs.slice(0, 8).concat([{ lib: 'Autres', n: autres }]); }
    var totalSpec = specs.reduce(function (s2, x) { return s2 + x.n; }, 0);
    h += '<section class="bloc"><div class="couv-tete"><h3>Par spécialité</h3><div class="segment petit" role="group" aria-label="Données">' +
      '<button type="button" data-a="statsSpec" data-v="base" aria-pressed="' + base + '">Base</button>' +
      '<button type="button" data-a="statsSpec" data-v="visites" aria-pressed="' + !base + '">Visites</button></div></div>' +
      '<p class="discret" style="margin:4px 0 8px">' + (base ? 'Médecins actifs de la base, par spécialité.' : 'Visites réalisées sur la période, par spécialité.') + '</p>';
    h += totalSpec ? barres(specs.map(function (x) {
      return { lib: x.lib, val: x.n, etiquette: x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)', tip: x.lib + ' : ' + x.n + ' (' + Math.round(100 * x.n / totalSpec) + ' %)' };
    })) + tableDonnees(['Spécialité', base ? 'Médecins' : 'Visites', 'Part'], specs.map(function (x) { return [x.lib, x.n, Math.round(100 * x.n / totalSpec) + ' %']; }))
      : '<p class="discret">Aucune visite réalisée sur la période.</p>';
    h += '</section>';

    // Par type de visite
    var parAct = {};
    r.effectives.forEach(function (v) { listeActivites(v.activite).forEach(function (x) { parAct[x] = (parAct[x] || 0) + 1; }); });
    var acts = Object.keys(parAct).map(function (k) { return { lib: k, n: parAct[k] }; }).sort(function (x, y) { return y.n - x.n; });
    if (acts.length) {
      h += '<section class="bloc"><h3>Par type de visite</h3>' + barres(acts.map(function (x) { return { lib: x.lib, val: x.n, etiquette: String(x.n), tip: x.lib + ' : ' + x.n }; })) +
        tableDonnees(['Type de visite', 'Visites'], acts.map(function (x) { return [x.lib, x.n]; })) + '</section>';
    }

    // Par délégué (équipe)
    if (r.equipe && r.delegues.length) {
      h += '<section class="bloc"><h3>Par délégué</h3>' + tableDonnees(['Délégué', 'Planifiées', 'Réalisées', 'Réalisation'], r.delegues.map(function (d) {
        var ech = r.echus.filter(function (a) { return a.delegue === d; }), ok = r.faits.filter(function (a) { return a.delegue === d; }).length;
        return [d, r.plan.filter(function (a) { return a.delegue === d; }).length, r.effectives.filter(function (v) { return v.delegue === d; }).length, txt(taux(ok, ech.length))];
      }), true) + '</section>';
    }
    h += '<section class="bloc"><h3>Objectif</h3><label class="champ" style="margin:0"><span>Visites par semaine' + (r.equipe ? ' et par délégué' : '') + '</span>' +
      '<input type="number" min="1" max="200" inputmode="numeric" data-f="stats" data-k="objectif" value="' + esc(st.objectif) + '"></label></section>';
    return h;
  };

  function kpi(valeur, titre, detail, jauge) {
    return '<div class="kpi"><b>' + esc(valeur) + '</b><span>' + esc(titre) + '</span><small>' + esc(detail) + '</small>' +
      (jauge !== undefined && jauge !== null ? '<div class="jauge' + (jauge >= 100 ? ' depasse' : '') + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' +
        Math.min(jauge, 100) + '" aria-label="' + esc(titre) + '"><i style="width:' + Math.min(jauge, 100) + '%"></i></div>' : '') + '</div>';
  }
  function legende(avecObjectif) {
    return '<div class="graph-legende"><span><i class="l-serie"></i>Réalisées</span><span><i class="l-piste"></i>Planifiées</span>' +
      (avecObjectif ? '<span><i class="l-objectif"></i>Objectif</span>' : '') + '</div>';
  }
  function tableDonnees(entetes, lignes, ouvert) {
    return '<details class="voir-table"' + (ouvert ? ' open' : '') + '><summary>' + (ouvert ? 'Détail' : 'Voir les données') + '</summary><table class="table-donnees"><thead><tr>' +
      entetes.map(function (e, i) { return '<th' + (i ? ' class="n"' : '') + '>' + esc(e) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      lignes.map(function (l) { return '<tr>' + l.map(function (v, i) { return '<td' + (i ? ' class="n"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></details>';
  }
  // Barre à extrémité arrondie (4 px) côté donnée, base plate
  function barreV(x, y, w, h) {
    if (h <= 0) return '';
    var r = Math.min(4, w / 2, h);
    return 'M' + x + ' ' + (y + h) + 'V' + (y + r) + 'Q' + x + ' ' + y + ' ' + (x + r) + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function barreH(x, y, w, h) {
    if (w <= 0) return '';
    var r = Math.min(4, h / 2, w);
    return 'M' + x + ' ' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + y + ' ' + (x + w) + ' ' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ' ' + (y + h) + ' ' + (x + w - r) + ' ' + (y + h) + 'H' + x + 'Z';
  }
  function graduation(max) {
    if (max <= 5) return Math.max(1, Math.ceil(max));
    var p = Math.pow(10, Math.floor(Math.log10(max))), n = max / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  }
  // Colonnes : planifiées (piste) et réalisées (série), ligne d'objectif en pointillé
  function colonnes(donnees, objectif) {
    var W = 340, H = 180, g = 28, bas = 22, haut = 10, n = donnees.length;
    var max = graduation(Math.max(1, objectif || 0, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.prevu, d.fait); }))));
    var bande = (W - g) / n, lw = Math.max(4, Math.min(26, bande * 0.62));
    var y = function (v) { return haut + (H - haut - bas) * (1 - v / max); };
    var s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Visites planifiées et réalisées">';
    [0, max / 2, max].forEach(function (v) {
      s += '<line class="grille" x1="' + g + '" x2="' + W + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/>' +
        '<text x="' + (g - 6) + '" y="' + (y(v) + 4).toFixed(1) + '" text-anchor="end">' + Math.round(v) + '</text>';
    });
    var pas = Math.ceil(n / 12);
    donnees.forEach(function (d, i) {
      var x = g + i * bande + (bande - lw) / 2, base = y(0);
      var hp = base - y(Math.max(d.prevu, d.fait)), hf = base - y(d.fait);
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="' + (g + i * bande).toFixed(1) + '" y="' + haut + '" width="' + bande.toFixed(1) + '" height="' + (H - haut - bas) + '" fill="transparent"/>' +
        '<path class="piste" d="' + barreV(+x.toFixed(1), +(base - hp).toFixed(1), +lw.toFixed(1), +hp.toFixed(1)) + '"/>' +
        '<path class="serie" d="' + barreV(+x.toFixed(1), +(base - hf).toFixed(1), +lw.toFixed(1), +hf.toFixed(1)) + '"/></g>';
      if (i % pas === 0) s += '<text x="' + (x + lw / 2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(d.lib) + '</text>';
    });
    if (objectif) s += '<line class="objectif" x1="' + g + '" x2="' + W + '" y1="' + y(objectif).toFixed(1) + '" y2="' + y(objectif).toFixed(1) + '"/>';
    return s + '</svg>';
  }
  // Barres horizontales : libellé à gauche, valeur en bout de barre ; piste facultative (planifiées)
  function barres(donnees) {
    var W = 340, lh = 26, gl = 104, dr = 58, H = donnees.length * lh + 4;
    var max = Math.max(1, Math.max.apply(null, donnees.map(function (d) { return Math.max(d.val, d.piste || 0); })));
    var larg = W - gl - dr, s = '<svg class="graph" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Graphique en barres">';
    donnees.forEach(function (d, i) {
      var y0 = i * lh + 4, bh = 14, yb = y0 + (lh - bh) / 2 - 2;
      var wp = larg * (d.piste || 0) / max, wv = larg * d.val / max;
      var lib = d.lib.length > 16 ? d.lib.slice(0, 15) + '…' : d.lib;
      s += '<g data-tip="' + esc(d.tip) + '"><rect x="0" y="' + y0 + '" width="' + W + '" height="' + lh + '" fill="transparent"/>' +
        '<text class="lib" x="' + (gl - 8) + '" y="' + (yb + 11) + '" text-anchor="end">' + esc(lib) + '</text>' +
        (d.piste !== undefined ? '<path class="piste" d="' + barreH(gl, +yb.toFixed(1), +Math.max(wp, wv).toFixed(1), bh) + '"/>' : '') +
        '<path class="serie" d="' + barreH(gl, +yb.toFixed(1), +wv.toFixed(1), bh) + '"/>' +
        '<text class="val" x="' + (gl + Math.max(wp, wv) + 6).toFixed(1) + '" y="' + (yb + 11) + '">' + esc(d.etiquette) + '</text></g>';
    });
    return s + '</svg>';
  }

  // Infobulle des graphiques (survol à la souris, toucher sur téléphone)
  function montrerInfobulle(el, x, y) {
    var b = $('infobulle'); if (!b) return;
    b.textContent = el.getAttribute('data-tip'); b.hidden = false;
    var w = b.offsetWidth, hgt = b.offsetHeight;
    b.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x - w / 2)) + 'px';
    b.style.top = Math.max(8, y - hgt - 14) + 'px';
  }
  function cacherInfobulle() { var b = $('infobulle'); if (b) b.hidden = true; }
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else if (e.pointerType === 'mouse') cacherInfobulle();
  });
  document.addEventListener('pointerdown', function (e) {
    var el = e.target.closest && e.target.closest('.graph [data-tip]');
    if (el) montrerInfobulle(el, e.clientX, e.clientY); else cacherInfobulle();
  });
  window.addEventListener('scroll', cacherInfobulle, { passive: true });

  // ------------------------------------------------------------------ Vue : historique
  VUES.historique = function (integre) {
    var enAttente = S.queue.slice().reverse().map(function (v) { v = Object.assign({}, v); v.attente = true; return v; });
    var tout = enAttente.concat((S.data.historique || []).filter(function (v) { return !S.queue.some(function (q) { return q.uid === v.uid; }); }));
    var hist = tout.filter(function (v) { return S.config.demo || quiCorrespond(v.delegue); });
    var t = aujourdhui(), lundi = lundiDe(t), mois = t.slice(0, 7), il30 = ajouterJours(t, -30), bh = bornesStats();
    var compte = function (v) { return Moteur.estVisite(v.statut, statuts()); };
    var sem = hist.filter(function (v) { return v.date >= lundi && compte(v); }).length;
    var moisN = hist.filter(function (v) { return String(v.date).slice(0, 7) === mois && compte(v); }).length;
    var derniers = hist.filter(function (v) { return v.date >= il30; });
    var taux = derniers.length ? 100 * derniers.filter(compte).length / derniers.length : null;
    var h = (integre ? '' : '<h2 class="titre-vue">Historique</h2>') + '<div class="chiffres">' +
      '<div class="chiffre"><b>' + sem + '</b><span>visites cette semaine</span></div>' +
      '<div class="chiffre"><b>' + moisN + '</b><span>visites ce mois-ci</span></div>' +
      '<div class="chiffre"><b>' + (taux === null ? 'n.d.' : pct(taux)) + '</b><span>présence sur 30 jours</span></div></div>';
    if (S.queue.length) h += '<div class="bandeau"><p>' + S.queue.length + ' compte(s) rendu(s) en attente d\'envoi. Ils partiront dès que le réseau revient.</p></div>';
    var liste = hist.filter(function (v) { var d = String(v.date || '').slice(0, 10); return v.attente || (d >= bh[0] && d <= bh[1]); });
    h += '<p class="discret" style="margin:12px 0 8px">' + liste.length + ' visite' + (liste.length > 1 ? 's' : '') + ' · ' + esc(libelleQui()) + ' · ' + esc(libelleBornes(bh)) + '</p>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucune visite sur cette période</strong>Changez de période ou de délégués.</div>';
    return h + '<ul class="liste">' + liste.slice(0, 150).map(function (v) {
      return '<li class="element' + classeType(v) + '"><div class="element-tete"><div>' +
        '<span class="element-titre">' + pastilleType(v) + esc(v.nom) + '</span>' +
        '<span class="discret bloc-texte">' + esc(v.lieu) + ', ' + esc(v.quartier) + '</span>' +
        (v.activite ? '<span class="bloc-texte discret" style="margin-top:4px">' + esc(v.activite) + '</span>' : '') +
        (v.produits ? '<span class="bloc-texte discret" style="margin-top:4px">Produits : ' + esc(v.produits) + '</span>' : '') +
        (v.commentaire ? '<span class="bloc-texte" style="margin-top:4px">' + esc(v.commentaire) + '</span>' : '') +
        (v.prochaine ? '<span class="bloc-texte discret">Prochain RDV le ' + dateCourte(String(v.prochaine).slice(0, 10)) + '</span>' : '') +
        '<span class="etiquettes"><span class="etiquette ' + (compte(v) ? 'ok' : 'ko') + '">' + esc(v.statut) + '</span>' +
        (v.attente ? '<span class="etiquette p1">En attente d\'envoi</span>' : '') +
        (v.delegue && !estMoi(v.delegue) ? '<span class="etiquette equipe">' + esc(v.delegue) + '</span>' : '') + '</span></div>' +
        '<div class="element-mesure">' + (v.date ? dateCourte(v.date) : '') + '<small>' + esc(v.creneau) + '</small></div></div></li>';
    }).join('') + '</ul>';
  };

  // ------------------------------------------------------------------ Vue : réglages
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
    var th = LS.get('theme', 'clair');
    h += '<section class="bloc"><h3>Apparence</h3><div class="segment" role="group" aria-label="Thème" style="margin:0">' +
      [['auto', 'Auto'], ['clair', 'Clair'], ['sombre', 'Sombre']].map(function (x) {
        return '<button type="button" data-a="theme" data-v="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div><p class="discret" style="margin:8px 0 0">Auto suit le réglage du téléphone.</p></section>';
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
      '<h3>Connexion au Google Sheet</h3>' +
      '<label class="champ"><span>URL de l\'application Web</span><input type="url" id="cfgUrl" inputmode="url" autocomplete="off" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(c.url) + '"></label>' +
      '<label class="champ"><span>Jeton d\'accès</span><input type="text" id="cfgToken" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(c.token) + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="tester">Tester</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="enregistrerConnexion">Enregistrer</button></div>' +
      (S.ui.erreur ? '<p class="discret" style="color:var(--rouge);margin-bottom:0">' + esc(S.ui.erreur) + '</p>' : '') +
      '<h3>Données</h3><p class="discret" style="margin-top:0">' +
      (S.config.demo ? 'Mode démonstration : les données restent sur ce téléphone.' :
        (S.data && S.data.syncedAt ? 'Dernière synchronisation : ' + new Date(S.data.syncedAt).toLocaleString('fr-FR') + '.' : 'Pas encore synchronisé.')) +
      (pret() ? ' ' + S.data.praticiens.length + ' praticiens, ' + S.data.presences.length + ' lieux de présence.' : '') +
      (S.queue.length ? ' ' + S.queue.length + ' compte(s) rendu(s) en attente.' : '') +
      (S.fiches.length ? ' ' + S.fiches.length + ' fiche(s) praticien en attente' + (S.ui.serveurAncien ? ' : le serveur Apps Script doit être mis à jour pour les recevoir.' : '.') : '') + '</p>' +
      (connecte() ? '<button class="bouton bouton-large" type="button" data-a="sync" style="margin-bottom:10px">Synchroniser maintenant</button>' : '') +
      '<button class="bouton bouton-large" type="button" data-a="demo" style="margin-bottom:10px">Charger les données de démonstration</button>' +
      '<h3>Sauvegarde</h3><p class="discret" style="margin-top:0">' +
        (S.data && S.data.sauvegarde ? 'Base : dernière copie le ' + new Date(S.data.sauvegarde).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' (7 copies dans Drive).' : 'Base : sauvegarde quotidienne à installer dans le Google Sheet (menu MediPlanner › Sauvegardes).') +
        ' Téléphone : ' + Object.keys(LS.get('secours', {})).length + ' copie(s) sur 7 jours.</p>' +
      '<div class="rangee" style="margin-bottom:10px"><button class="bouton" type="button" data-a="exporterSecours">' + icone('telecharger') + 'Exporter</button>' +
        '<label class="bouton" style="position:relative;overflow:hidden">' + icone('relancer') + 'Importer<input type="file" accept="application/json,.json" data-f="importSecours" style="position:absolute;inset:0;opacity:0"></label></div>' +
      '<button class="bouton bouton-large bouton-danger" type="button" data-a="reinitialiser">Effacer les données de ce téléphone</button></details>';
    return h;
  };

  // ------------------------------------------------------------------ Feuilles (fenêtres du bas)
  function rendreFeuille() {
    var f = S.ui.feuille, el = $('feuille');
    if (!f) { el.hidden = true; el.innerHTML = ''; el.dataset.ouverte = ''; document.body.classList.remove('feuille-ouverte'); return; }
    el.hidden = false; document.body.classList.add('feuille-ouverte');
    var contenu = FEUILLES[f.type](f), pied = '';
    if (typeof contenu === 'object') { pied = contenu.pied; contenu = contenu.corps; }
    var defil = el.querySelector('.feuille-corps'), haut = defil && el.dataset.type === f.type + (f.etape || '') ? defil.scrollTop : 0;
    var nouvelle = !defil || el.dataset.ouverte !== f.type;
    el.dataset.type = f.type + (f.etape || ''); el.dataset.ouverte = f.type;
    el.innerHTML = '<div class="voile" data-a="fermerFeuille"></div><div class="feuille' + (f.pleine ? ' pleine' : '') + (nouvelle ? ' anim' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(f.titre || '') + '">' +
      '<div class="poignee" aria-hidden="true"></div><div class="feuille-tete"><button type="button" class="retour-feuille" data-a="fermerFeuille" aria-label="Retour">' + icone('chevron') + '</button><b>' + esc(f.titre || '') + '</b></div>' +
      '<div class="feuille-corps">' + contenu + '</div>' + (pied ? '<div class="feuille-pied">' + pied + '</div>' : '') + '</div>';
    if (haut) el.querySelector('.feuille-corps').scrollTop = haut;
    // bande des produits : le produit choisi glisse au centre (depuis la position précédente)
    var bp = el.querySelector('.bande-produits'), sel = bp && bp.querySelector('[data-copie="1"][aria-pressed="true"]');
    if (sel) {
      var debuts = bp.querySelectorAll('[data-debut]'), W = debuts[1].offsetLeft - debuts[0].offsetLeft;
      var cible = sel.offsetLeft - (bp.clientWidth - sel.offsetWidth) / 2;
      // depuis la position précédente, ramenée dans la copie du milieu au plus près de la cible
      var dep = S.ui.bpDepart;
      if (dep !== undefined && dep !== null && !nouvelle) {
        while (dep - cible > W / 2) dep -= W;
        while (cible - dep > W / 2) dep += W;
        bp.scrollLeft = dep;
        try { bp.scrollTo({ left: cible, behavior: reduireAnimations() ? 'auto' : 'smooth' }); } catch (e) { bp.scrollLeft = cible; }
      } else bp.scrollLeft = cible;
      bp.addEventListener('scroll', function () {
        // boucle : on saute d'une copie (contenu identique, saut invisible) quand on approche d'un bord
        if (bp.scrollLeft < W * 0.5) bp.scrollLeft += W;
        else if (bp.scrollLeft > W * 1.5) bp.scrollLeft -= W;
        S.ui.bpDepart = bp.scrollLeft;
      }, { passive: true });
      S.ui.bpDepart = bp.scrollLeft;
    }
  }
  // fiche d'un produit : l'essentiel ouvert (indications, contre-indications, arguments), le reste à déplier
  FEUILLES.ficheProduit = function (fe) {
    var f = fichesProduits().filter(function (x) { return x.produit === fe.produit; })[0]; if (!f) return '';
    var ouvertes = fe.ouvertes || {};
    var h = '<p class="fp-dci"><b>' + esc(f.dci) + '</b></p><p class="fiche-classe" style="margin-top:2px">' + esc(f.classe || '') + '</p>';
    SECTIONS_FICHE.forEach(function (sec) {
      var it = lignesFiche(f[sec[0]]); if (!it.length) return;
      var essentiel = sec[2] === 'ind' || sec[2] === 'ci' || sec[2] === 'arg', ouvert = essentiel || ouvertes[sec[0]];
      h += '<div class="fiche-section ' + sec[2] + (essentiel ? '' : ' repliable') + '">' +
        (essentiel ? '<h4>' + sec[1] + '</h4>' : '<button type="button" class="fp-bascule" data-a="ficheSection" data-v="' + sec[0] + '" aria-expanded="' + !!ouvert + '"><h4>' + sec[1] + '</h4>' + icone('chevron') + '</button>') +
        (ouvert ? '<ul>' + it.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') + '</div>';
    });
    h += '<p class="discret fiche-pied">' + esc(f.laboratoire || '') + (f.sources ? ' · Sources : ' + esc(f.sources) : '') + '</p>';
    // 3.24.15 : en bas, tous les produits de la liste (même ordre que l'onglet), à faire glisser comme les dates de Journée ;
    // le produit affiché est au centre, en couleur ; on ferme avec la croix en haut
    var ordre = [];
    gammesProduits(fichesProduits()).forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (x) { ordre.push(x.produit); });
    });
    // 3.24.19 : bande en boucle (après le dernier, le premier revient) : la liste est répétée 3 fois,
    // on reste dans la copie du milieu ; les copies de bord sont invisibles pour les lecteurs d'écran
    var pied = '<div class="bande-produits boucle" role="group" aria-label="Produits">' + [0, 1, 2].map(function (k) {
      return ordre.map(function (n, j) {
        return '<button type="button" class="bp-produit" data-a="produitOuvrir" data-v="' + esc(n) + '" data-copie="' + k + '"' + (j === 0 ? ' data-debut="1"' : '') +
          (k !== 1 ? ' aria-hidden="true" tabindex="-1"' : '') + ' aria-pressed="' + (n === f.produit) + '">' + esc(n) + '</button>';
      }).join('');
    }).join('') + '</div>';
    return { corps: h, pied: pied };
  };


  FEUILLES.communes = function (f) {
    var h = groupeChoix(f, { id: 'communes', titre: 'Communes', chemin: 'sel', multiple: true, sections: sectionsCommunes(), recherche: true,
      aide: f.cle === 'tout' ? 'Aucune sélection = toutes les communes.' : 'Aucune sélection = les communes choisies pour la semaine.' });
    return { corps: h, pied: '<button class="bouton" type="button" data-a="communesAucune">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="communesOk">' + (f.sel.length ? 'Valider · ' + f.sel.length + ' commune' + (f.sel.length > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
  };

  FEUILLES.recherche = function (f) {
    var c = ctx(), q = normaliser(f.q || ''), h = '';
    if (!f.code) {
      h += '<div class="recherche">' + icone('loupe') + '<input type="search" id="rechercheImpose" data-f="rechercheImpose" placeholder="Nom, spécialité, lieu…" value="' + esc(f.q || '') + '" autofocus></div>';
      if (q.length < 2) return h + '<p class="discret">Tapez au moins 2 lettres.</p>';
      var res = Object.keys(c.prat).map(function (k) { return c.prat[k]; }).filter(function (p) {
        var lieux = (c.presencesParCode[p.code] || []).map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        return normaliser(p.nom + ' ' + p.specialite + ' ' + lieux).indexOf(q) >= 0;
      }).slice(0, 30);
      if (!res.length) return h + '<p class="discret">Aucun praticien trouvé.</p>';
      return h + '<ul class="liste">' + res.map(function (p) {
        return '<li><button type="button" class="element carte-bouton" data-a="choisirImpose" data-v="' + esc(p.code) + '">' +
          '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span><span class="discret bloc-texte">' + esc(p.specialite) + ', ' +
          esc(Array.from(new Set((c.presencesParCode[p.code] || []).map(function (x) { return x.commune; }))).join(', ')) + '</span></button></li>';
      }).join('') + '</ul>';
    }
    var p = c.prat[f.code], dates = datesPeriode();
    var options = [];
    dates.forEach(function (d) {
      var j = jourSemaineIndex(d);
      (c.parCode[f.code] || []).forEach(function (cr) { if (cr.jourIdx === j) options.push({ d: d, c: cr }); });
    });
    h += '<p><b>' + esc(p.nom) + '</b> ' + etoiles(p.note) + '<span class="discret bloc-texte">' + esc(p.specialite) + '</span></p>';
    h += '<p class="discret">Présences sur la période :</p>';
    h += '<div class="choix-creneaux"><label class="choix"><input type="radio" name="impCle" value=""' + (!f.cle ? ' checked' : '') + '><span><b>Au meilleur moment</b><small>L\'application choisit le jour le plus pratique</small></span></label>' +
      options.map(function (o) {
        var v = o.d + '|' + o.c.cle;
        return '<label class="choix"><input type="radio" name="impCle" value="' + esc(v) + '"' + (f.cle === v ? ' checked' : '') + '><span><b>' +
          majuscule(dateCourte(o.d)) + ', ' + o.c.creneau.toLowerCase() + ' ' + minutesVersHeure(o.c.debut) + '-' + minutesVersHeure(o.c.fin) + '</b><small>' +
          esc(o.c.lieu) + ', ' + esc(o.c.quartier) + '</small></span></label>';
      }).join('') + '</div>';
    if (!options.length) h += '<p class="discret" style="color:var(--rouge)">Ce praticien n\'est présent aucun jour de la période choisie.</p>';
    h += '<label class="champ"><span>Heure de RDV (facultatif)</span><input type="time" id="impRdv" value="' + esc(f.rdv || '') + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="retourRecherche">Retour</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="ajouterImpose"' + (options.length ? '' : ' disabled') + '>Ajouter</button></div>';
    return h;
  };

  FEUILLES.exporter = function (f) {
    var t = aujourdhui(), dates = f.portee === 'jour' ? [S.ui.jour] : datesPlan().filter(function (d) { return d >= t && jourConfirme(d); });
    var texte = texteProgramme(dates);
    f.texte = texte;
    var num = normaliserNumero(S.config.whatsapp);
    return '<div class="segment" role="group" aria-label="Contenu"><button type="button" data-a="exportPortee" data-v="jour" aria-pressed="' + (f.portee === 'jour') + '">Le ' + dateCourte(S.ui.jour) + '</button>' +
      '<button type="button" data-a="exportPortee" data-v="semaine" aria-pressed="' + (f.portee !== 'jour') + '">Jours confirmés à venir</button></div>' +
      '<pre class="apercu">' + esc(texte) + '</pre>' +
      (texte.length > 3500 ? '<p class="discret">Message long : si WhatsApp le coupe, envoyez jour par jour.</p>' : '') +
      (num ? '<p class="discret">Envoi vers votre numéro +' + esc(num) + (S.config.waWeb || !estMobile() ? ', avec WhatsApp Web.' : ', avec l\'application WhatsApp.') + '</p>' :
        '<p class="discret">Renseignez votre numéro dans les Réglages pour l\'envoyer directement dans votre conversation.</p>') +
      '<button class="bouton bouton-plein bouton-large wa" type="button" data-a="envoyerWhatsapp">' + icone('whatsapp') + 'Envoyer par WhatsApp</button>' +
      '<div class="rangee" style="margin-top:10px"><button class="bouton" type="button" data-a="copierTexte">Copier le texte</button>' +
      (navigator.share ? '<button class="bouton" type="button" data-a="partagerTexte">Partager…</button>' : '') + '</div>';
  };

  FEUILLES.anciens = function (f) {
    if (f.source) {
      var sem = f.source.type === 'semaine', c = f.cible, existants = S.plan.filter(function (a) { return sem ? lundiDe(a.date) === lundiDe(c) : a.date === c; });
      var weekend = !sem && jourSemaineIndex(c) > 4;
      return { corps: '<p style="margin-top:0"><b>À reprendre :</b> ' + (sem ? 'semaine du ' + dateCourte(f.source.valeur) : majuscule(dateLongue(f.source.valeur))) + '.</p>' +
        '<label class="champ"><span>' + (sem ? 'Sur quelle semaine ? (choisissez un jour de la semaine)' : 'Sur quel jour ?') + '</span><input type="date" data-f="repriseCible" min="' + aujourdhui() + '" value="' + esc(c) + '"></label>' +
        '<p class="discret">' + (sem ? 'Semaine du ' + dateCourte(lundiDe(c)) + ' au ' + dateCourte(joursOuvres(lundiDe(c))[4]) + ', chaque jour sur le même jour de la semaine.' : majuscule(dateLongue(c)) + '.') + '</p>' +
        (weekend ? '<p class="discret" style="color:var(--rouge)">Choisissez un jour de semaine.</p>' : '') +
        (existants.length ? '<div class="bandeau"><p>' + existants.length + ' visite' + (existants.length > 1 ? 's' : '') + ' déjà prévue' + (existants.length > 1 ? 's' : '') +
          ' sur ' + (sem ? 'cette semaine' : 'ce jour') + ' seront remplacées (les comptes rendus enregistrés sont conservés). Vous pourrez revenir à l\'ancienne planification.</p></div>' : ''),
        pied: '<button class="bouton" type="button" data-a="repriseRetour">Retour</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="repriseConfirmer"' + (weekend ? ' disabled' : '') + '>Reprendre</button>' };
    }
    var l = anciensProgrammes(), p = S.params;
    if (!l.length) return '<p class="discret" style="margin-top:0">Aucun ancien programme pour l\'instant. Vos tournées sont mémorisées au fil de l\'eau : elles apparaîtront ici dès la semaine prochaine (8 dernières semaines).</p>';
    var semCible = joursOuvres(lundiDe(p.dateRef))[0];
    var h = '<p class="discret" style="margin-top:0">Choisissez la semaine ou le jour à reprendre, puis le jour ou la semaine sur lesquels le copier. Il est copié en <b>brouillon</b> ; vous pourrez le conserver ou revenir à l\'ancienne planification.</p>';
    h += l.map(function (s2) {
      var jours = Object.keys(s2.jours).sort(), n = jours.reduce(function (t, d) { return t + s2.jours[d].length; }, 0);
      var com = []; jours.forEach(function (d) { s2.jours[d].forEach(function (x) { if (x.commune && com.indexOf(x.commune) < 0) com.push(x.commune); }); });
      return '<section class="bloc ancien"><div class="ancien-tete"><div><b>Semaine du ' + dateCourte(s2.lundi) + '</b><span class="discret bloc-texte">' + n + ' visite' + (n > 1 ? 's' : '') + ', ' + esc(libelleCommunes(com)) + '</span></div>' +
        '<button class="bouton petit bouton-plein" type="button" data-a="reprendre" data-t="semaine" data-v="' + s2.lundi + '">Reprendre la semaine</button></div>' +
        '<div class="puces">' + jours.map(function (d) {
          return '<button type="button" class="puce" data-a="reprendre" data-t="jour" data-v="' + d + '">' + majuscule(dateCourte(d)) + ' · ' + s2.jours[d].length + '</button>';
        }).join('') + '</div></section>';
    }).join('');
    return h + '<p class="discret">Touchez un jour pour ne reprendre que celui-ci.</p>';
  };

  FEUILLES.remplacer = function (f) {
    var a = arret(f.uid);
    if (!a) return '<p class="discret">Visite introuvable.</p>';
    if (f.choix) {
      var x = f.choix;
      if (f.garder) return { corps: '<p style="margin-top:0">Ajouter <b>' + esc(x.nom) + '</b> ' + etoiles(x.note) + ' (' + esc(x.heure) + ', ' + esc(x.lieu) + ', ' + esc(x.quartier) + ') à votre journée,<br>en remplacement de <b>' + esc(a.nom) + '</b> (' + esc(statutLibelle(a).toLowerCase()) + ') ?</p><p class="discret">Le compte rendu de ' + esc(a.nom) + ' est conservé. L\'ordre de passage sera recalculé.</p>',
        pied: piedQuestion('data-a="remplacerOui"', 'Ajouter', 'remplacerNon') };
      return { corps: '<p style="margin-top:0">Remplacer <b>' + esc(a.nom) + '</b> (' + esc(a.heure) + ', ' + esc(a.lieu) + ')<br>par <b>' + esc(x.nom) + '</b> ' + etoiles(x.note) +
          ' (' + esc(x.heure) + ', ' + esc(x.lieu) + ', ' + esc(x.quartier) + ') ?</p><p class="discret">' + majuscule(dateLongue(a.date)) + '. L\'ordre de passage sera recalculé.</p>',
        pied: piedQuestion('data-a="remplacerOui"', 'Remplacer', 'remplacerNon') };
    }
    var l = candidatsRemplacement(a);
    if (!l.length) return '<p class="discret" style="margin-top:0">Aucun autre praticien disponible ce jour-là selon vos critères (communes, spécialités, collègues). Vous pouvez garder ' + esc(a.nom) + ' ou le retirer.</p>';
    return '<p class="discret" style="margin-top:0">Praticiens présents le ' + dateFr(a.date) + ', hors de votre tournée et non prévus par un collègue, selon vos critères. Choisissez celui qui remplacera <b>' + esc(a.nom) + '</b> :</p>' +
      '<ul class="liste">' + l.map(function (x) {
        var p = x.cr.prat;
        return '<li><button type="button" class="element carte-bouton" data-a="remplacerChoisir" data-v="' + esc(x.cr.cle) + '" data-h="' + esc(x.heure) + '">' +
          '<span class="element-titre">' + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
          '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, x.cr.lieu, x.cr.quartier])) + '</span>' +
          '<span class="discret bloc-texte">' + x.cr.creneau + ' ' + minutesVersHeure(x.cr.debut) + '-' + minutesVersHeure(x.cr.fin) + ' · passage vers ' + esc(x.heure) +
            (x.dist < 99 ? ' · ' + km(x.dist) + ' du lieu remplacé' : '') + '</span>' +
          '<span class="etiquettes">' + badgeConv(p.conventionne) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, a.date)) + '</span>' +
            (x.ok ? '' : '<span class="etiquette alerte">Horaire difficile à tenir</span>') + '</span></button></li>';
      }).join('') + '</ul>';
  };
  FEUILLES.ajouterJour = function (f) {
    var q = (f && f.q) || '';
    return champRechercheLibre('rechAjout', q) +
      '<div id="resAjout">' + resultatsAjout(q) + '</div>' +
      '<p class="discret" style="margin-top:0">Ou complétez votre journée avec un praticien présent près de vous.</p><div class="choix-ajout">' +
      [['Médecin', 'plus', 'Médecin', 'Présents près de vous, selon vos spécialités'], ['Pharmacie', 'plus', 'Pharmacie', 'Ouvertes près de vous'], ['autour', 'cible', 'Autour de moi', 'Tous les praticiens, avec filtres']].map(function (x) {
        return '<button type="button" class="tuile" data-a="ajouterJourChoix" data-v="' + x[0] + '"><b>' + icone(x[1]) + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></button>';
      }).join('') + '</div>';
  };
  // 3.25.0 : recherche libre (nom, spécialité, établissement, quartier, commune) parmi les praticiens présents ce jour-là,
  // selon les filtres de la tournée, dès les premières lettres
  function resultatsAjout(q) {
    var d = S.ui.dateAjout || S.ui.jour, j = jourSemaineIndex(d), mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    if (!mots.length) return '';
    if (j > 4) return '<p class="discret">Aucun praticien présent le week-end.</p>';
    var filtre = filtreCibles(), dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dans[cr.code] || absentLe(p, d) || (filtre && !filtre(p))) return;
      if (S.ui.typeAjout && (S.ui.typeAjout === 'Pharmacie') !== (p.type === 'Pharmacie')) return;
      var txt = normaliser([p.nom, p.specialite, cr.lieu, cr.quartier, cr.commune].join(' '));
      if (!mots.every(function (m) { return txt.indexOf(m) >= 0; })) return;
      var x = { cr: cr, score: Moteur.scoreDe(p, d) };
      if (!vus[cr.code] || x.score > vus[cr.code].score) vus[cr.code] = x;
    });
    var l = Object.keys(vus).map(function (k) { return vus[k]; }).sort(function (x, y) { return y.score - x.score; }).slice(0, 30);
    if (!l.length) return '<p class="discret">Aucun praticien présent le ' + dateFr(d) + ' ne correspond, selon vos filtres.</p>';
    return '<ul class="liste">' + l.map(function (x) {
      var cr = x.cr, p = cr.prat;
      return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
        '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, cr.lieu, cr.quartier, cr.commune])) + '</span>' +
        '<span class="discret bloc-texte">' + cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d)) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  FEUILLES.ajouterTournee = function (f) {
    var rech = '';   // 3.25.3 : la recherche se fait dans la liste « Selon mes filtres »
    var t = S.ui.typeAjout, qui = t === 'Médecin' ? 'Médecins' : t === 'Pharmacie' ? 'Pharmacies' : 'Praticiens';
    var filtres = libelleCommunes(communesDuJour(S.ui.dateAjout || S.ui.jour)) + (t === 'Médecin' && (S.params.specialites || []).length ? ' · ' + libelleListe(S.params.specialites, '') : '');
    return rech + '<div class="choix-ajout">' + [['position', 'cible', 'Par ma position', qui + ' présents près de vous'],
      ['communes', 'filtre', 'Selon mes filtres', filtres]].map(function (x) {
      return '<button type="button" class="tuile" data-a="ajouterTourneeChoix" data-v="' + x[0] + '"><b>' + icone(x[1]) + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></button>';
    }).join('') + '</div>';
  };
  // communes du jour : celles de la planification (par jour si réglé), sinon celles des visites déjà prévues
  function communesDuJour(d) {
    var l = communesPour(d) || [];
    if (!l.length) l = Array.from(new Set(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.commune; }).filter(Boolean)));
    return l;
  }
  // 3.25.2 : champ de recherche en tête, pour chercher parmi les praticiens déjà filtrés (communes du jour, critères)
  FEUILLES.ajouterCommunes = function (f) {
    var d = S.ui.dateAjout || S.ui.jour, com = Object.keys(ensemble(communesDuJour(d))), q = (f && f.q) || '';
    return '<p class="discret" style="margin-top:0">Présents le ' + esc(dateLongue(d)) + (com.length ? ' dans ' + esc(libelleCommunes(com)) : '') + ', hors de votre tournée et non prévus par un collègue.</p>' +
      champRechercheLibre('rechCommunes', q) + '<div id="resCommunes">' + resultatsCommunes(q) + '</div>';
  };
  function resultatsCommunes(q) {
    var d = S.ui.dateAjout || S.ui.jour, j = jourSemaineIndex(d), com = ensemble(communesDuJour(d)), filtre = filtreCibles(), ex = exclusCollegues([d]);
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dans[cr.code] || ex[cr.code] || (Object.keys(com).length && !com[cr.commune]) || (filtre && S.ui.typeAjout !== 'Pharmacie' && !filtre(p)) || absentLe(p, d)) return;
      if (S.ui.typeAjout && (S.ui.typeAjout === 'Pharmacie') !== (p.type === 'Pharmacie')) return;
      if (mots.length) {
        var txt = normaliser([p.nom, p.specialite, cr.lieu, cr.quartier, cr.commune].join(' '));
        if (!mots.every(function (m) { return txt.indexOf(m) >= 0; })) return;
      }
      var x = { cr: cr, score: Moteur.scoreDe(p, d) };
      if (!vus[cr.code] || x.score > vus[cr.code].score) vus[cr.code] = x;
    });
    // 3.25.8 : position connue (GPS récent ou Autour de moi) : du plus proche au plus loin
    var pos = positionActuelle();
    Object.keys(vus).forEach(function (k) { vus[k].dist = pos && vus[k].cr.coord ? distanceVol(pos, vus[k].cr.coord) : null; vus[k].approx = !!(vus[k].cr.coord && vus[k].cr.coord.approx); });
    var tous = Object.keys(vus).map(function (k) { return vus[k]; }).sort(function (x, y) {
      return pos ? (x.dist === null) - (y.dist === null) || (x.dist || 0) - (y.dist || 0) || y.score - x.score : y.score - x.score;
    }), l = tous.slice(0, mots.length ? 60 : 30);
    if (!l.length) return '<p class="discret">' + (mots.length ? 'Aucun résultat pour « ' + esc(q) + ' » parmi ces praticiens.' : 'Aucun autre praticien présent ce jour-là dans ' + esc(libelleCommunes(Object.keys(com))) + ', selon vos critères.') + '</p>';
    return (mots.length ? '<p class="discret">' + tous.length + ' résultat' + (tous.length > 1 ? 's' : '') + '.</p>' : '') +
      '<ul class="liste">' + l.map(function (x) {
        var cr = x.cr, p = cr.prat;
        return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
          '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
          '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [p.specialite, cr.lieu, cr.quartier])) + '</span>' +
          '<span class="discret bloc-texte">' + cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d)) + (x.dist !== null && x.dist !== undefined ? ' · <b>' + (x.approx ? '≈ ' : '') + distanceCourte(x.dist) + '</b>' + (x.approx ? ' <small>(position du quartier)</small>' : '') : '') + '</span></button></li>';
      }).join('') + '</ul>' + (tous.length > l.length ? '<p class="discret">' + (tous.length - l.length) + ' autres : précisez la recherche.</p>' : '');
  }
  FEUILLES.installer = function () {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    return '<p style="margin-top:0">' + (ios ? 'Dans Safari : ' + icone('partager') + ' Partager, puis « Sur l\'écran d\'accueil ».' :
      'Dans Chrome : menu ⋮, puis « Installer l\'application » (ou « Ajouter à l\'écran d\'accueil »).') + '</p>';
  };
  function estInstallee() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  FEUILLES.confirmer = function (f) {
    return { corps: '<p style="margin-top:0">' + f.message + '</p>',
      pied: piedQuestion('data-a="confirmerOui"', esc(f.oui), 'confirmerNon') };
  };

  FEUILLES.refusProgramme = function () {
    return { corps: '<p style="margin-top:0">La tournée reste en <b>brouillon</b> : elle n\'est ni validée ni partagée.</p>',
      pied: '<button class="bouton" type="button" data-a="quitterSansValider">Quitter sans valider</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="continuerModifier">' + icone('crayon') + 'Continuer à modifier</button>' };
  };
  FEUILLES.valide = function (f) {
    var l = f.dates || [];
    return { corps: '<p style="margin-top:0">' + (l.length === 1 ? majuscule(dateLongue(l[0])) + ' est confirmé' : (l.length ? l.length + ' jours sont confirmés' : 'Votre tournée est confirmée')) +
        ' et visible par l\'équipe.</p>',
      pied: '<button class="bouton bouton-plein bouton-large wa" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer par WhatsApp</button>' };
  };

  // Choix multiple générique (spécialités ciblées par la tournée)
  FEUILLES.multi = function (f) {
    var h = groupeChoix(f, { id: 'multi', titre: f.titreGroupe || 'Choix', chemin: 'sel', multiple: true, recherche: f.options.length > 8, aide: f.aide,
      options: f.options.map(function (o) { return { v: o.nom, lib: o.nom, n: o.n }; }) });
    var total = f.sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
    return { corps: h, pied: '<button class="bouton" type="button" data-a="multiAucun">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="multiOk">' + (f.sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
  };

  // Filtres avancés de la liste des praticiens (cumulables)
  var TRIS = [['priorite', 'Potentiel'], ['score', 'Priorité de visite'], ['retard', 'Plus longtemps sans visite'], ['nom', 'Nom']];
  // Planifier un praticien depuis sa fiche : prochaine présence, ou +7, +14, +21, +28 jours, puis Oui / Non
  FEUILLES.planifierDate = function (f) {
    var c = Moteur.creneauParCle(ctx(), f.cle); if (!c) return '';
    var p = praticien(c.code) || {};
    var dates = [0, 7, 14, 21, 28].map(function (n) { return ajouterJours(f.d0, n); });
    var dejaLa = function (d) { return S.plan.some(function (a) { return a.code === c.code && a.date === d; }); };
    var absent = function (d) { return p.absentDu && d >= p.absentDu && (!p.absentAu || d <= p.absentAu); };
    var h = '<div class="cr-pas etapes-filtres"><div class="cr-question"><span class="etape-titre">Quelle date ?</span>' +
      '<p class="discret" style="margin:4px 0 0">' + esc(c.prat.nom) + ' : ' + esc(c.lieu) + ', ' + JOURS[c.jourIdx].toLowerCase() + ' ' + c.creneau.toLowerCase() +
      ' (' + minutesVersHeure(c.debut) + '-' + minutesVersHeure(c.fin) + ')</p><div class="puces">' +
      dates.map(function (d, i) {
        var bloque = estFerie(d) || absent(d) || dejaLa(d);
        return '<button type="button" class="puce" data-a="planifierDateChoix" data-v="' + d + '" aria-pressed="' + (f.d === d) + '"' + (bloque ? ' disabled' : '') + '>' +
          dateFr(d) + '<small>' + (i ? '+' + (i * 7) + ' j' : 'prochaine') + (estFerie(d) ? ', férié' : absent(d) ? ', absent' : dejaLa(d) ? ', déjà prévu' : '') + '</small></button>';
      }).join('') + '</div></div>' +
      '<p style="margin:14px 0 0">Ajouter <b>' + esc(c.prat.nom) + '</b> à votre tournée du <b>' + dateFr(f.d) + '</b> ?</p></div>';
    return { corps: h, pied: piedQuestion('data-a="planifierDateOui"', 'Ajouter') };
  };
  FEUILLES.listeChoix = function (f) {
    var cfg = S.ui.listes[f.id] || {}, n = 0;
    var map = function (l) { return l.map(function (o) { n++; return { v: o[0], lib: o[1] }; }); };
    var o = { id: 'l', titre: 'Un seul choix', chemin: 'sel', recherche: true };
    if (cfg.sections) o.sections = cfg.sections.map(function (x) { return { titre: x.titre, options: map(x.options) }; }); else o.options = map(cfg.options || []);
    if (n <= 8) o.recherche = false;
    return groupeChoix(f, o);
  };
  FEUILLES.crListe = function (f) {
    var h = groupeChoix(f, { id: 'l', titre: f.multi ? 'Plusieurs choix possibles' : 'Un seul choix', chemin: 'sel', multiple: f.multi, recherche: f.options.length > 8,
      options: f.options.map(function (o) { return { v: o[0], lib: o[1] }; }) });
    return f.multi ? { corps: h, pied: '<button class="bouton" type="button" data-a="crListeAucun">Effacer</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="crListeOk">Valider' + (f.sel.length ? ' · ' + f.sel.length : '') + '</button>' } : h;
  };
  FEUILLES.filtres = function (f) {
    var b = f.brouillon, n = filtrerPraticiens(b, rechercheCour()).length, seule = f.question;
    function opt(l) { return l.map(function (x) { return { v: x[0], lib: x[1], n: x[2] }; }); }
    var blocs = {
      qui: groupeChoix(f, { id: 'type', titre: 'Type de praticien', chemin: 'brouillon.type', options: opt([['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']]) }),
      spec: b.type === 'Pharmacie' ? '<p class="discret groupe-aide">Les spécialités ne concernent pas les pharmacies. Celles choisies restent mémorisées pour les médecins' +
          (b.specialites.length ? ' (' + esc(b.specialites.join(', ')) + ')' : '') + '.</p>' :
        groupeChoix(f, { id: 'spec', titre: 'Spécialités', chemin: 'brouillon.specialites', multiple: true, repliable: !seule, recherche: true, resume: 'Toutes',
          options: specialitesListe().map(function (x) { return { v: x.nom, lib: x.nom, n: x.n }; }),
          aide: b.type === 'tous' ? 'S\'appliquent aux médecins seulement ; les pharmacies restent affichées.' : '' }),
      com: groupeChoix(f, { id: 'com', titre: 'Communes', chemin: 'brouillon.communes', multiple: true, repliable: !seule, recherche: true, resume: 'Toutes', sections: sectionsCommunes(),
        aide: 'Lieux d\'exercice du praticien. Pour un établissement ou un quartier, utilisez la recherche de la liste.' }),
      valeur: groupeChoix(f, { id: 'pot', titre: 'Potentiel de prescription', chemin: 'brouillon.potentiels', multiple: true,
          options: opt([['A', '★★★', 'fort'], ['B', '★★', 'moyen'], ['C', '★', 'faible']]) }) +
        groupeChoix(f, { id: 'conv', titre: 'Engagé', chemin: 'brouillon.conv', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) }),
      suivi: groupeChoix(f, { id: 'visite', titre: 'Dernière visite (un seul choix)', chemin: 'brouillon.visite', options: opt([['tous', 'Toutes'], ['jamais', 'Jamais visité'],
          ['30', 'Non visité +30 j'], ['retard', 'En retard sur la cadence'], ['revoir', 'À revoir'], ['recent', 'Vu il y a moins de 30 j']]) }) +
        (S.config.demo ? '' : groupeChoix(f, { id: 'equipe', titre: 'Prévu par un collègue cette semaine', chemin: 'brouillon.equipe', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) })),
      ordre: S.ui.tab === 'praticiens' ? groupeChoix(f, { id: 'tri', titre: 'Trier la liste par', chemin: 'tri', options: opt(TRIS) }) : ''
    };
    var ordre = seule ? [seule] : ['qui', 'spec', 'com', 'valeur', 'suivi', 'ordre'], num = 0;
    var h = ordre.map(function (k) {
      if (!blocs[k]) return '';
      num++;
      return '<div class="question-filtre">' + (seule ? '' : '<h3><span class="num">' + num + '</span>' + QUESTIONS_FILTRES[k].titre + '</h3>') + blocs[k] + '</div>';
    }).join('');
    var libOk = S.ui.tab === 'autour' ? 'Appliquer' : 'Afficher ' + n + ' praticien' + (n > 1 ? 's' : '');
    return { corps: h, pied: '<button class="bouton" type="button" data-a="filtresReinit">' + (seule ? 'Effacer' : 'Tout effacer') + '</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="filtresOk">' + libOk + '</button>' };
  };

  // ------------------------------------------------------------------ Fiche praticien : assistant en 4 étapes
  var ETAPES_FICHE = ['Informations', 'Spécialité', 'Disponibilités', 'Localisation'];
  // 3.25.5 : saisie assistée de l'établissement : dès quelques lettres, les établissements déjà connus de la base
  // (lieu, quartier, commune), pour reprendre exactement le même nom et éviter les doublons mal orthographiés
  function etablissementsConnus() {
    var vus = {}, l = [];
    ((S.data && S.data.presences) || []).forEach(function (x) {
      var nom = String(x.lieu || '').trim(); if (!nom || /^NL$/i.test(nom)) return;
      var k = normaliser(nom), e = vus[k];
      if (!e) { e = vus[k] = { lieu: nom, quartier: '', commune: '', lat: '', lon: '', n: 0, txt: k }; l.push(e); }
      e.n++;
      if (!e.quartier && x.quartier && !/^NL$/i.test(x.quartier)) e.quartier = x.quartier;
      if (!e.commune && x.commune) e.commune = x.commune;
      var la = parseFloat(String(x.lat).replace(',', '.')), lo = parseFloat(String(x.lon).replace(',', '.'));
      if (!e.lat && isFinite(la) && isFinite(lo) && la) { e.lat = la; e.lon = lo; }
    });
    l.forEach(function (e) { e.txt = normaliser(e.lieu + ' ' + e.quartier + ' ' + e.commune); });
    return l;
  }
  function suggestionsLieu(q, i) {
    var t = normaliser(q || ''), mots = t ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.sugLieux = S.ui.sugLieux || {}; S.ui.sugLieux[i] = [];
    if (!mots.length || t.length < 2) return '';
    var l = etablissementsConnus().filter(function (e) { return mots.every(function (m) { return e.txt.indexOf(m) >= 0; }); });
    if (l.some(function (e) { return normaliser(e.lieu) === t; })) return '<p class="aide-champ ok-lieu">' + icone('valider') + 'Établissement connu de la base.</p>';
    var rang = function (e) { var n = normaliser(e.lieu); return (mots.every(function (m) { return n.indexOf(m) >= 0; }) ? 0 : 2) + (n.indexOf(mots[0]) === 0 ? 0 : 1); };
    l.sort(function (a, b) { return rang(a) - rang(b) || b.n - a.n || a.lieu.localeCompare(b.lieu, 'fr'); });
    l = l.slice(0, 6); S.ui.sugLieux[i] = l;
    if (!l.length) return '<p class="aide-champ">Aucun établissement correspondant dans la base : il sera créé tel que saisi.</p>';
    return '<p class="aide-champ">Déjà dans la base, touchez pour reprendre le même nom :</p><ul class="sug-liste">' + l.map(function (e, k) {
      return '<li><button type="button" data-a="ficheChoixLieu" data-i="' + i + '" data-v="' + k + '"><b>' + esc(e.lieu) + '</b><small>' +
        esc([e.quartier, e.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + ' · ' + e.n + ' praticien' + (e.n > 1 ? 's' : '') + '</small></button></li>';
    }).join('') + '</ul>';
  }
  function lieuVide() {
    return { id: '', lieu: '', quartier: '', jours: [0, 1, 2, 3, 4].map(function () { return { matin: false, soir: false }; }),
             horaireMatin: REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: REGLAGES_MOTEUR.horaireSoirDefaut, lat: '', lon: '' };
  }
  function brouillonFiche(code) {
    if (!code) return { code: '', type: 'Médecin', nom: '', telephone: '', specialite: '', autreSpec: '', note: 2, conventionne: 'Non', actif: 'Oui', lieux: [lieuVide()] };
    var p = (S.data.praticiens || []).filter(function (x) { return x.code === code; })[0] || {};
    var lieux = (S.data.presences || []).filter(function (x) { return x.code === code; }).map(function (x) {
      return { id: x.id, lieu: x.lieu || '', quartier: x.quartier || '', jours: JOURS_CLES.map(function (j) { return lireDispo(x[j]); }),
               horaireMatin: x.horaireMatin || REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: x.horaireSoir || REGLAGES_MOTEUR.horaireSoirDefaut,
               lat: x.lat || '', lon: x.lon || '', commune: x.commune || '', zone: x.zone || '' };
    });
    return { code: code, type: p.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin', nom: p.nom || '', telephone: String(p.telephone || ''),
             specialite: p.specialite || '', autreSpec: '', note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
             actif: 'Oui', absentDu: p.absentDu || '', absentAu: p.absentAu || '', lieux: lieux.length ? lieux : [lieuVide()] };
  }
  function horaireValide(t) {
    var m = String(t || '').match(/^\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*-\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*$/);
    if (!m) return false;
    var a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    return +m[1] < 24 && +m[3] < 24 && a < b;
  }
  // Erreurs d'une étape : { champ: message }
  function erreursEtape(d, etape) {
    var e = {};
    if (etape === 0) {
      if (String(d.nom).trim().length < 3) e.nom = 'Indiquez le nom complet (3 caractères minimum).';
      if (String(d.telephone).trim() && !normaliserNumero(d.telephone)) e.telephone = 'Numéro non reconnu : 10 chiffres, par exemple 07 07 07 07 07.';
    }
    if (etape === 1 && d.type === 'Médecin') {
      if (!d.specialite) e.specialite = 'Choisissez une spécialité.';
      else if (d.specialite === '__autre' && String(d.autreSpec).trim().length < 3) e.autreSpec = 'Précisez la spécialité.';
    }
    if (etape === 2) {
      if (!d.lieux.length) e.lieux = 'Ajoutez au moins un lieu d\'exercice.';
      if (d.absentAu && !d.absentDu) e.absentDu = 'Indiquez le début de l\'absence.';
      if (d.absentDu && d.absentAu && d.absentAu < d.absentDu) e.absentAu = 'La fin doit suivre le début.';
      d.lieux.forEach(function (l, i) {
        if (String(l.lieu).trim().length < 2) e['lieu' + i] = 'Nom de l\'établissement ou du cabinet requis.';
        var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
        if (!m && !so) e['jours' + i] = 'Cochez au moins une demi-journée de présence.';
        if (m && !horaireValide(l.horaireMatin)) e['hm' + i] = 'Format attendu : 08:00-12:00 (début avant fin).';
        if (so && !horaireValide(l.horaireSoir)) e['hs' + i] = 'Format attendu : 15:00-19:00 (début avant fin).';
      });
    }
    if (etape === 3) {
      var connus = {}; quartiers().forEach(function (q) { connus[q.quartier] = true; });
      d.lieux.forEach(function (l, i) { if (!connus[l.quartier]) e['quartier' + i] = 'Choisissez le quartier de « ' + (l.lieu || 'ce lieu') + ' ».'; });
    }
    return e;
  }
  function champFiche(cle, libelle, contenu, f, requis, aide) {
    var err = f.err[cle] || '';
    return '<div class="champ"><span class="' + (requis ? 'requis' : '') + '">' + libelle + '</span>' + contenu +
      (aide ? '<span class="aide-champ">' + aide + '</span>' : '') + '<span class="erreur" data-err="' + cle + '" id="err-' + cle + '">' + esc(err) + '</span></div>';
  }
  function attrInvalide(f, cle) { return (f.err[cle] ? ' aria-invalid="true"' : '') + ' aria-describedby="err-' + cle + '"'; }

  FEUILLES.fiche = function (f) {
    // même parcours que Planifier et le compte rendu : étapes faites repliées en lignes, étape en cours dans son cadre
    var d = f.d, e = f.etape;
    var resumes = [
      function () { return (d.type === 'Pharmacie' ? 'Pharmacie' : 'Médecin') + (d.nom ? ' · ' + d.nom : ''); },
      function () { return (d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? d.autreSpec : d.specialite) || '') + ' · ' + ETOILES[lettrePotentiel(+d.note)] + (d.conventionne === 'Oui' ? ' · Engagé' : ''); },
      function () { return d.lieux.length + ' lieu' + (d.lieux.length > 1 ? 'x' : '') + ' : ' + d.lieux.map(function (l) { return l.lieu; }).filter(Boolean).join(', '); },
      function () { return d.lieux.map(function (l) { return l.quartier; }).filter(Boolean).join(', '); }
    ];
    var h = '<div class="cr-pas etapes-filtres">' + ETAPES_FICHE.map(function (t, i) {
      return i < e ? '<button type="button" class="cr-fait" data-a="ficheAller" data-v="' + i + '"><span>' + t + '</span><b>' + esc(resumes[i]()) + '</b>' + icone('crayon') + '</button>' : '';
    }).join('') + '<div class="cr-question"><span class="etape-titre">' + ETAPES_FICHE[e] + ' <small>étape ' + (e + 1) + '/' + ETAPES_FICHE.length + '</small></span>';
    if (e === 0) {
      h += '<p class="discret" style="margin-top:0">Les champs marqués * sont obligatoires.</p>' +
        '<div class="segment" role="group" aria-label="Type">' + ['Médecin', 'Pharmacie'].map(function (t) {
          return '<button type="button" data-a="ficheVal" data-k="type" data-v="' + t + '" aria-pressed="' + (d.type === t) + '">' + t + '</button>';
        }).join('') + '</div>' +
        champFiche('nom', d.type === 'Pharmacie' ? 'Nom de la pharmacie' : 'Nom du médecin',
          '<input type="text" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '" placeholder="' + (d.type === 'Pharmacie' ? 'Ex. Pharmacie des Lagunes' : 'Ex. Dr Kouassi Aya') + '"' + attrInvalide(f, 'nom') + '>', f, true) +
        champFiche('telephone', 'Téléphone', '<input type="tel" inputmode="tel" data-f="fiche" data-k="telephone" value="' + esc(d.telephone) + '" placeholder="07 07 07 07 07"' + attrInvalide(f, 'telephone') + '>', f, false,
          'Facultatif. Sert aux boutons Appeler et SMS.');
      var homonyme = !d.code && String(d.nom).trim().length >= 3 && (S.data.praticiens || []).filter(function (p) { return normaliser(p.nom) === normaliser(d.nom); })[0];
      if (homonyme) h += '<div class="bandeau"><p>Un praticien porte déjà ce nom (' + esc(homonyme.code) + '). Vérifiez qu\'il ne s\'agit pas d\'un doublon.</p></div>';
      if (d.code) h += '<label class="interrupteur"><span>Praticien actif (sinon retiré des tournées, historique conservé)</span><input type="checkbox" data-f="fiche" data-k="actif"' + (d.actif !== 'Non' ? ' checked' : '') + '></label>';
    }
    if (e === 1) {
      h += '';
      if (d.type === 'Pharmacie') h += '<p class="discret">Spécialité enregistrée : Pharmacien.</p>';
      else {
        var specs = specialitesListe().map(function (x) { return x.nom; });
        SPECIALITES_DEFAUT.forEach(function (x) { if (x !== 'Pharmacien' && specs.indexOf(x) < 0) specs.push(x); });
        specs.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
        if (d.specialite && d.specialite !== '__autre' && specs.indexOf(d.specialite) < 0) specs.unshift(d.specialite);
        h += champFiche('specialite', 'Spécialité', selecteurListe('ficheSpec', { titre: 'Spécialité', valeur: d.specialite, vide: 'Choisir…', invalide: !!f.err.specialite,
          options: specs.map(function (x) { return [x, x]; }).concat([['__autre', 'Autre spécialité…']]),
          appliquer: function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.specialite = v; delete fe.err.specialite; } } }), f, true);
        if (d.specialite === '__autre') h += champFiche('autreSpec', 'Autre spécialité', '<input type="text" data-f="fiche" data-k="autreSpec" value="' + esc(d.autreSpec) + '"' + attrInvalide(f, 'autreSpec') + '>', f, true);
      }
      h += '<div class="champ"><span class="requis">Potentiel de prescription</span><div class="segment" role="group" aria-label="Potentiel" style="margin:0">' +
        [3, 2, 1].map(function (n) {
          var l = lettrePotentiel(n);
          return '<button type="button" data-a="ficheVal" data-k="note" data-v="' + n + '" aria-pressed="' + (+d.note === n) + '">' + ETOILES[l] + ' ' + LIB_POTENTIEL[l] + '</button>';
        }).join('') + '</div><span class="aide-champ">★★★ : à voir tous les ' + REGLAGES_MOTEUR.cadence[3] + ' jours, ★★ : ' + REGLAGES_MOTEUR.cadence[2] + ' jours, ★ : ' + REGLAGES_MOTEUR.cadence[1] + ' jours.</span></div>' +
        '<label class="interrupteur"><span>Engagé</span><input type="checkbox" data-f="fiche" data-k="conventionne"' + (d.conventionne === 'Oui' ? ' checked' : '') + '></label>';
    }
    if (e === 2) {
      h += '<p class="discret" style="margin-top:0">Pour chaque lieu d\'exercice : les demi-journées de présence et leurs horaires.</p>';
      if (f.err.lieux) h += '<p class="erreur-texte">' + esc(f.err.lieux) + '</p>';
      d.lieux.forEach(function (l, i) {
        var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
        h += '<div class="lieu-bloc"><div class="lieu-tete"><b>Lieu ' + (i + 1) + '</b>' +
          (d.lieux.length > 1 ? '<button type="button" class="bouton-texte" data-a="ficheRetirerLieu" data-i="' + i + '">Supprimer</button>' : '') + '</div>' +
          champFiche('lieu' + i, 'Établissement ou cabinet', '<input type="text" data-f="fiche" data-k="lieu" data-i="' + i + '" value="' + esc(l.lieu) + '" placeholder="Tapez quelques lettres, ex. CHU Coc"' + attrInvalide(f, 'lieu' + i) + ' autocomplete="off">', f, true) +
          '<div class="sug-lieux" id="sugLieu' + i + '">' + suggestionsLieu(l.lieu, i) + '</div>' +
          '<div class="grille-dispo" role="group" aria-label="Présences du lieu ' + (i + 1) + '"><span></span><span class="entete-col">Matin</span><span class="entete-col">Soir</span>' +
          JOURS.map(function (j, k) {
            return '<span class="jour-nom">' + j + '</span>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="matin" aria-pressed="' + l.jours[k].matin + '" aria-label="' + j + ' matin">' + (l.jours[k].matin ? 'Présent' : '–') + '</button>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="soir" aria-pressed="' + l.jours[k].soir + '" aria-label="' + j + ' soir">' + (l.jours[k].soir ? 'Présent' : '–') + '</button>';
          }).join('') + '</div>' +
          '<span class="erreur" data-err="jours' + i + '">' + esc(f.err['jours' + i] || '') + '</span>' +
          '<div class="grille-2">' +
          champFiche('hm' + i, 'Horaires du matin', '<input type="text" data-f="fiche" data-k="horaireMatin" data-i="' + i + '" value="' + esc(l.horaireMatin) + '"' + (m ? '' : ' disabled') + attrInvalide(f, 'hm' + i) + '>', f, m) +
          champFiche('hs' + i, 'Horaires du soir', '<input type="text" data-f="fiche" data-k="horaireSoir" data-i="' + i + '" value="' + esc(l.horaireSoir) + '"' + (so ? '' : ' disabled') + attrInvalide(f, 'hs' + i) + '>', f, so) +
          '</div>' +
          // 3.25.11 : position du lieu récupérée sur place, juste après les horaires
          '<div class="gps-ligne gps-centre"><button type="button" class="bouton petit" data-a="ficheGps" data-i="' + i + '">' + icone('cible') + 'Récupérer la position</button>' +
            (l.lat && l.lon ? '<span>GPS : ' + (+String(l.lat).replace(',', '.')).toFixed(5) + ', ' + (+String(l.lon).replace(',', '.')).toFixed(5) + '</span>' : '<span>Pas de position GPS</span>') + '</div></div>';
      });
      h += '<button class="bouton bouton-large" type="button" data-a="ficheAjouterLieu">' + icone('plus') + 'Ajouter un lieu d\'exercice</button>';
      h += '<div class="lieu-bloc" style="margin-top:12px"><div class="lieu-tete"><b>Absence (congés, formation…)</b></div>' +
        '<div class="grille-2">' +
        champFiche('absentDu', 'Absent du', '<input type="date" data-f="fiche" data-k="absentDu" value="' + esc(d.absentDu || '') + '"' + attrInvalide(f, 'absentDu') + '>', f, false) +
        champFiche('absentAu', 'Au', '<input type="date" data-f="fiche" data-k="absentAu" value="' + esc(d.absentAu || '') + '"' + attrInvalide(f, 'absentAu') + '>', f, false) +
        '</div><span class="aide-champ">Facultatif. Le praticien n\'est pas proposé dans les tournées pendant cette période.</span></div>';
    }
    if (e === 3) {
      var parCommune = {};
      quartiers().forEach(function (q) { (parCommune[q.commune] = parCommune[q.commune] || []).push(q.quartier); });
      h += '<p class="discret" style="margin-top:0">Le quartier place le lieu sur la carte et dans les tournées. La position GPS, facultative, rend les trajets plus précis.</p>';
      d.lieux.forEach(function (l, i) {
        var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0];
        h += '<div class="lieu-bloc"><div class="lieu-tete"><b>' + esc(l.lieu || 'Lieu ' + (i + 1)) + '</b></div>' +
          champFiche('quartier' + i, 'Quartier', selecteurListe('ficheQuartier' + i, { titre: 'Quartier', valeur: l.quartier, vide: 'Choisir un quartier…', invalide: !!f.err['quartier' + i], sections: sectionsQuartiers(),
            appliquer: (function (k) { return function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.lieux[k].quartier = v; delete fe.err['quartier' + k]; } }; })(i) }), f, true, q ? 'Commune : ' + esc(q.commune) + ', ' + esc(q.zone) : '') +
          '<div class="gps-ligne">' + (l.lat && l.lon ? 'GPS : ' + (+l.lat).toFixed(5) + ', ' + (+l.lon).toFixed(5) +
            ' <button type="button" class="bouton-texte" data-a="ficheGpsEffacer" data-i="' + i + '">Effacer</button>' : 'Pas de position GPS') +
            '</div></div>';
      });
      h += '<dl class="recap bloc"><dt>Praticien</dt><dd>' + esc(d.nom) + ' ' + etoiles(d.note) + '</dd><dt>Spécialité</dt><dd>' +
        esc(d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? d.autreSpec : d.specialite)) + (d.conventionne === 'Oui' ? ', engagé' : '') + '</dd>' +
        '<dt>Présences</dt><dd>' + d.lieux.map(function (l) {
          var j = JOURS.map(function (n, k) { var x = l.jours[k]; return x.matin || x.soir ? n.slice(0, 3) + ' ' + (x.matin && x.soir ? 'M+S' : (x.matin ? 'M' : 'S')) : ''; }).filter(Boolean).join(', ');
          return esc(l.lieu) + ' : ' + esc(j);
        }).join('<br>') + '</dd></dl>';
    }
    h += '</div></div>';
    var pied = (e > 0 ? '<button class="bouton" type="button" data-a="ficheEtape" data-v="-1">Précédent</button>' : '<button class="bouton" type="button" data-a="fermerFeuille">Annuler</button>') +
      (e < 3 ? '<button class="bouton bouton-plein" type="button" data-a="ficheEtape" data-v="1">Suivant</button>'
             : '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>');
    return { corps: h, pied: pied };
  };

  // Applique une fiche aux données locales (affichage immédiat, même hors ligne)
  function appliquerFiche(pr, pres) {
    if (!S.data) return;
    var ex = S.data.praticiens.filter(function (x) { return x.code === pr.code; })[0];
    if (ex) Object.keys(pr).forEach(function (k) { ex[k] = pr[k]; });
    else S.data.praticiens.push(Object.assign({ derniere: '', statut: '', commentaire: '', nbVisites: 0 }, pr));
    S.data.presences = S.data.presences.filter(function (x) { return x.code !== pr.code; }).concat(pres.map(function (x) { return Object.assign({}, x); }));
    ctxCache.data = null;
  }
  function enregistrerFiche(d) {
    var code = d.code || 'TMP-' + Date.now().toString(36).toUpperCase();
    var pr = { code: code, type: d.type, nom: String(d.nom).trim(), telephone: String(d.telephone || '').trim(),
               specialite: d.type === 'Pharmacie' ? 'Pharmacien' : (d.specialite === '__autre' ? String(d.autreSpec).trim() : d.specialite),
               note: +d.note, conventionne: d.conventionne, actif: d.actif === 'Non' ? 'Non' : 'Oui',
               absentDu: d.absentDu || '', absentAu: d.absentAu || '' };
    var pres = d.lieux.map(function (l) {
      var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0] || {};
      var o = { id: l.id || 'TMP' + Math.random().toString(36).slice(2, 8), code: code, nom: pr.nom, lieu: String(l.lieu).trim(), quartier: l.quartier,
                commune: q.commune || l.commune || '', zone: q.zone || l.zone || '', horaireMatin: String(l.horaireMatin || '').trim(), horaireSoir: String(l.horaireSoir || '').trim(),
                lat: l.lat || '', lon: l.lon || '' };
      JOURS_CLES.forEach(function (j, k) { o[j] = ecrireDispo(l.jours[k]); });
      return o;
    });
    appliquerFiche(pr, pres);
    if (!S.config.demo) {
      S.fiches = S.fiches.filter(function (f) { return f.praticien.code !== code; }).concat([{ praticien: pr, presences: pres }]);
    }
    sauver();
    return code;
  }

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
        x.noms.forEach(function (m) { lignes.push('• ' + (m.heure ? m.heure + '  ' : '') + m.nom); });
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

  // ------------------------------------------------------------------ Actions sur la tournée
  function arret(uid) { return S.plan.filter(function (a) { return a.uid === uid; })[0] || (S.horsPlan || []).filter(function (a) { return a.uid === uid; })[0]; }

  function reordonner(date) {
    var autres = S.plan.filter(function (a) { return a.date !== date; }), duJour = S.plan.filter(function (a) { return a.date === date; });
    var g = S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, jour;
    // 3.25.8 : aujourd'hui, avec une position GPS récente : les visites faites restent, les autres s'enchaînent depuis ma position
    if (date === aujourdhui() && g && duJour.some(function (a) { return !a.statut; })) {
      jour = duJour.filter(function (a) { return a.statut; }).concat(Moteur.ordonnerJour(duJour.filter(function (a) { return !a.statut; }), { lat: g.lat, lon: g.lon }));
    } else jour = Moteur.ordonnerJour(duJour, departCoord());
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
  // carte ouverte : centrée dans l'espace visible (entre l'en-tête et la barre du bas) ; si elle est plus haute, son haut est aligné
  function centrerCarte(uid) { centrerElement(document.querySelector('.arret.ouvert') || document.querySelector('[data-uid="' + uid + '"]')); }
  function centrerElement(c) {
    if (!c) return;
    var r = c.getBoundingClientRect(), ent = (document.querySelector('.entete') || { offsetHeight: 0 }).offsetHeight,
        nav = (document.querySelector('.navigation') || { offsetHeight: 0 }).offsetHeight, dispo = window.innerHeight - ent - nav;
    var cible = r.height <= dispo - 16 ? ent + (dispo - r.height) / 2 : ent + 8;
    window.scrollTo({ top: Math.max(0, window.scrollY + r.top - cible), behavior: 'smooth' });
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
    sauver(); rendre();
    var nCorr = aValider.filter(function (a) { return a.uid && S.queue.some(function (q) { return q.uid === a.uid && q.correction; }); }).length;
    toast((nCorr === aValider.length ? (nCorr > 1 ? nCorr + ' comptes rendus modifiés' : 'Compte Rendu modifié') : aValider.length + ' compte(s) rendu(s) enregistré(s)') + (ko ? '. ' + ko + ' visite(s) non réalisée(s) : utilisez « Remplacer ».' : '.') +
      (placees ? ' Prochaine étape ajoutée à votre tournée.' : ''), 4500);
    publierPlan(!placees);
  }

  function ajouterArret(c, date) {
    if (S.plan.some(function (a) { return a.date === date && a.code === c.code; })) { toast('Ce praticien est déjà prévu ce jour-là.'); return false; }
    var a = Moteur.arretDepuisCreneau(c, date);
    a.etat = 'ajoute'; a.garde = true;
    S.plan.push(a);
    reordonner(date);
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
      if (!p.prochaine || p.prochaine < debut || p.prochaine > fin || dejaImposes[p.code]) return false;
      var qui = auteur[p.code + '|' + p.prochaine];
      return !qui || estMoi(qui);
    }).map(function (p) { return { code: p.code, apres: p.prochaine < dates[0] ? dates[0] : p.prochaine, etape: true, dateRdv: p.prochaine, prisLe: prisLe[p.code + '|' + p.prochaine] || '' }; });
  }
  function placerImpose(im) {
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

  // 3.25.9 : position du téléphone lue en continu quelques secondes : on garde la mesure la plus précise
  // (arrêt dès ± 25 m, ou après 12 s) ; jamais de position en cache. discret : sans écran d'attente (rafraîchissement automatique)
  function localiser(discret) {
    if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
    if (S.ui.localisation) return;
    S.ui.localisation = discret ? 'discret' : true; if (!discret && S.ui.tab === 'autour') rendre();
    if (!discret) toast('Recherche de votre position…');
    var best = null, fini = false, id = null, minuteur = null;
    function terminer() {
      if (fini) return; fini = true;
      if (id !== null) navigator.geolocation.clearWatch(id); clearTimeout(minuteur);
      S.ui.localisation = false;
      if (!best) { if (S.ui.tab === 'autour') rendre(); if (!discret) toast('Position indisponible. Autorisez la localisation ou choisissez un quartier.'); return; }
      var A = S.ui.autour, la = best.coords.latitude, lo = best.coords.longitude, prec = Math.round(best.coords.accuracy || 0);
      var r = Moteur.quartierLePlusProche(la, lo, quartiers());
      A.lat = la; A.lon = lo; A.src = 'gps'; A.prec = prec; A.t = Date.now();
      S.ui.posGps = { lat: la, lon: lo, t: Date.now(), prec: prec };
      A.label = r ? 'ma position (près ' + (/^[aeiouyéèàâîôûAEIOUYÉÈÀÂÎÔÛ]/.test(r.quartier.quartier) ? 'd\'' : 'de ') + r.quartier.quartier + ')' : 'ma position';
      LS.set('autour', A); rendre();
      if (!discret && prec > 150) toast('Position imprécise (± ' + prec + ' m). Activez la « localisation précise » du téléphone, ou sortez à découvert.');
      else if (!discret && r && r.km > 8) toast('Vous semblez hors d\'Abidjan. Quartier le plus proche : ' + r.quartier.quartier + '.');
    }
    id = navigator.geolocation.watchPosition(function (p) {
      if (!best || precisionDe(p) < precisionDe(best)) best = p;
      if (precisionDe(best) <= 25) terminer();
    }, function (e) { if (e && e.code === 1) terminer(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    minuteur = setTimeout(terminer, 12000);
  }
  // pendant que « Autour de moi » est affiché (position GPS), la position est rafraîchie chaque minute
  setInterval(function () {
    if (S.ui.tab === 'autour' && !document.hidden && positionGps() && S.ui.autour.lat !== null && !S.ui.localisation) localiser(true);
  }, 60000);
  // 3.25.9 : une mesure GPS fraîche et précise (meilleure lecture sur 12 s au plus, arrêt dès ± 25 m)
  function mesurePrecise(ok, ko) {
    if (!navigator.geolocation) { if (ko) ko(); return; }
    var best = null, fini = false, id = null, t = null;
    function terminer() {
      if (fini) return; fini = true;
      if (id !== null) navigator.geolocation.clearWatch(id); clearTimeout(t);
      if (best) ok({ lat: best.coords.latitude, lon: best.coords.longitude, prec: Math.round(best.coords.accuracy || 0) }); else if (ko) ko();
    }
    id = navigator.geolocation.watchPosition(function (p) {
      if (!best || precisionDe(p) < precisionDe(best)) best = p;
      if (precisionDe(best) <= 25) terminer();
    }, function (e) { if (e && e.code === 1) terminer(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    t = setTimeout(terminer, 12000);
  }
  function precisionDe(p) { var a = p && p.coords && p.coords.accuracy; return a === null || a === undefined || isNaN(a) ? 9999 : a; }
  function distanceCourte(k) { return k < 1 ? Math.max(10, Math.round(k * 100) * 10) + ' m' : km(k); }
  function gpsPrecis() { var g = S.ui.posGps; return !!(g && Date.now() - g.t < 5 * 60000 && g.prec && g.prec <= 60); }
  // 3.25.8 : position actuelle connue : GPS de moins de 15 min, sinon le point choisi dans « Autour de moi »
  function positionActuelle() {
    var g = S.ui.posGps; if (g && Date.now() - g.t < 15 * 60000) return { lat: g.lat, lon: g.lon };
    var A = S.ui.autour; return A && A.lat !== null && A.lat !== undefined ? { lat: A.lat, lon: A.lon } : null;
  }
  // position issue du GPS (et non d'un quartier choisi) : à recalculer à chaque ouverture
  // 3.25.9 : rayons proposés autour de moi
  var RAYONS = [0.5, 2, 5, 10];
  if (RAYONS.indexOf(+S.ui.autour.rayon) < 0) { S.ui.autour.rayon = +S.ui.autour.rayon > 10 ? 10 : 2; LS.set('autour', S.ui.autour); }
  function positionGps() { var A = S.ui.autour; return A.src === 'gps' || (!A.src && /^ma position/.test(A.label || '')) || A.lat === null; }
  function relocaliserSiBesoin() {
    if (S.ui.tab === 'autour' && positionGps() && !S.ui.localisation) localiser();
  }

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

  var ACTIONS = {
    nav: function (el) {
      if (el.dataset.tab === 'semaine' && S.ui.tab !== 'semaine' && (!S.plan.length || S.ui.voirParams)) etapesPDepuisDebut();
      // 3.24.14 : Bilan s'ouvre toujours sur le Tableau de bord
      if (el.dataset.tab === 'bilan' && S.ui.tab !== 'bilan') { S.ui.statsVue = 'tableau'; LS.set('statsVue', 'tableau'); }
      // 3.25.0 : Planifier et Journée gardent chacun leur jour sélectionné (Planifier : demain par défaut)
      if (S.ui.tab === 'semaine' && el.dataset.tab !== 'semaine') { S.ui.jourPlan = S.ui.jour; S.ui.jour = S.ui.jourJournee || aujourdhui(); }
      else if (S.ui.tab !== 'semaine' && el.dataset.tab === 'semaine') { S.ui.jourJournee = S.ui.jour; if (S.ui.jourPlan) S.ui.jour = S.ui.jourPlan; else S.ui.planInit = false; }
      S.ui.tab = el.dataset.tab; S.ui.pharmaciesProches = false;
      if (S.ui.tab === 'historique') { S.ui.tab = 'bilan'; S.ui.statsVue = 'historique'; } S.ui.feuille = null;
      rendre(); window.scrollTo(0, 0);
      if (S.ui.tab === 'equipe') rafraichirEquipe().then(function (ok) { if (ok && S.ui.tab === 'equipe') rendreSiPossible(); });
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
    voirVisite: function (el) { S.ui.tab = 'jour'; S.ui.ouvert = el.dataset.uid; rendre(); var c = document.querySelector('.arret.ouvert'); if (c) c.scrollIntoView({ block: 'start' }); },
    ouvrirAutour: function () { S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; rendre(); window.scrollTo(0, 0); relocaliserSiBesoin(); },
    generer: function () { lancerTirage('nouveau'); },
    tirage: function (el) { lancerTirage(el.dataset.v); },
    jour: function (el) {
      var b = el.parentNode; if (b && b.classList.contains('bj-jours')) S.ui.bjDepart = el.getBoundingClientRect().left - b.getBoundingClientRect().left;
      S.ui.jour = el.dataset.v; S.ui.jourVue = null; S.ui.ouvert = null; rendre();
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
    ouvrirVisite: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      if (a.date !== jourAffiche() && !a.hors) { S.ui.jour = a.date; S.ui.jourVue = null; }
      S.ui.tab = 'jour'; S.ui.ouvert = a.uid; rendre(); centrerCarte(a.uid);
    },
    ajouterJour: function () { S.ui.dateAjout = jourAffiche(); S.ui.typeAjout = null; S.ui.feuille = { type: 'ajouterJour', titre: 'Ajouter à la journée' }; rendre(); },
    ajouterJourChoix: function (el) {
      S.ui.feuille = null; var v = el.dataset.v;
      if (v === 'autour') ACTIONS.ouvrirAutour(); else ACTIONS.ajouterProches({ dataset: { v: v } });
    },
    allerRapport: function () { S.ui.tab = 'rapport'; rendre(); window.scrollTo(0, 0); },
    ouvrirRapport: function () { S.ui.tab = 'rapport'; rendre(); window.scrollTo(0, 0); },
    rapOk: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = true; sauverRapports(); rendre(); },
    rapPrec: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); },
    rapPasser: function (el) {
      var R = rapportOuCree(jourAffiche()), k = el.dataset.v;
      if (k === 'besoins') { R.besoins = []; R.besoinsTexte = ''; } else R[k] = '';
      R.ok[k] = true; sauverRapports(); rendre();
    },
    rapEditer: function (el) { var R = rapportOuCree(jourAffiche()); R.ok[el.dataset.v] = false; sauverRapports(); rendre(); },
    rapBesoin: function (el) {
      var R = rapportOuCree(jourAffiche()), l = R.besoins || (R.besoins = []), i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v); sauverRapports(); rendre();
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
    rapWhatsapp: function (el) { window.open(urlWhatsapp(texteRapport(el.dataset.v), S.config.waResp), '_blank', 'noopener'); },
    rapCopier: function (el) { copier(texteRapport(el.dataset.v)); },
    jourReprendre: function (el) {
      var d = el.dataset.v;
      confirmerPuis('Reprendre ce programme', 'Remplacer votre tournée en cours par le programme du <b>' + dateFr(d) + '</b> ?<br><span class="discret">Vous pourrez revenir à l\'ancienne planification.</span>',
        'Reprendre', function () { S.ui.jourVue = null; reprendreProgramme('jour', d, d); });
    },
    quitterCarte: function () { S.ui.ouvert = null; rendre(); },
    ouvrir: function (el) {
      S.ui.ouvert = S.ui.ouvert === el.dataset.uid ? null : el.dataset.uid; rendre();
      if (S.ui.ouvert) centrerCarte(S.ui.ouvert);
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
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), t = aujourdhui(); if (!c) return;
      if (!ajouterArret(c, t)) { rendre(); return; }
      var a = S.plan.filter(function (x) { return x.date === t && x.code === c.code; })[0];
      ACTIONS.procheOui({ dataset: { uid: a.uid, ajout: '1' } });
    },
    pharmaNon: function (el) {
      var r = LS.get('refusPharmacies', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), codes: {} };
      r.codes[el.dataset.v] = true; LS.set('refusPharmacies', r); rendre();
    },
    procheNon: function (el) {
      var r = LS.get('refusProches', {}); if (r.d !== aujourdhui()) r = { d: aujourdhui(), uids: {} };
      r.uids[el.dataset.uid] = true; LS.set('refusProches', r); rendre();
    },
    accepterJour: function () { var d = S.ui.aAccepter || S.ui.jour; confirmerProgramme([d]); },
    // 3.25.0 : Accepter valide puis propose WhatsApp ; Ne pas accepter : continuer à modifier ou quitter sans valider
    accepterProgramme: function () { confirmerProgramme(joursBrouillon()); },
    refuserProgramme: function (el) { S.ui.feuille = { type: 'refusProgramme', titre: 'Tournée non acceptée', jour: el.dataset.v === 'jour' }; rendre(); },
    continuerModifier: function () {
      var j = S.ui.feuille && S.ui.feuille.jour; S.ui.feuille = null;
      if (j) { S.ui.aAccepter = null; rendre(); toast('Ajoutez, retirez ou épinglez des médecins, puis recalculez.'); return; }
      etapesPDepuisDebut(); S.ui.voirParams = true; rendre(); window.scrollTo(0, 0);
    },
    quitterSansValider: function () { S.ui.feuille = null; S.ui.aAccepter = null; S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0); toast('Tournée laissée en brouillon, non envoyée à l\'équipe.'); },
    recalculerEncore: function () { lancerTirage('jour'); },
    confirmerProgrammeDirect: function () { confirmerProgramme(); },

    corriger: function (el) {
      var a = arret(el.dataset.uid); if (!a) return; a.etat = 'correction'; a.corrige = true; a.empreinte = empreinteCr(a);
      var c = crDe(a); c.ok = c.ok || {}; etapesCr(a).forEach(function (x) { if (x.id && x.id.indexOf('__') !== 0) c.ok[x.id] = true; }); S.ui.ouvert = a.uid; LS.set('plan', S.plan); rendre(); },
    ouvrirExport: function () {
      var f = S.ui.feuille, l = f && f.type === 'valide' ? f.dates || [] : [S.ui.jour];
      if (l.length === 1) S.ui.jour = l[0];
      S.ui.feuille = { type: 'exporter', titre: 'Envoyer par WhatsApp', portee: l.length > 1 ? 'semaine' : 'jour' }; rendre();
    },
    ajouterTournee: function (el) {
      S.ui.dateAjout = (el && el.dataset && el.dataset.d) || S.ui.jour; S.ui.typeAjout = null;
      S.ui.feuille = { type: 'ajouterTournee', titre: S.ui.tab === 'jour' ? 'Autour de moi, ' + dateCourte(S.ui.dateAjout) : 'Ajouter au ' + dateCourte(S.ui.dateAjout) }; rendre();
    },
    ajouterTourneeChoix: function (el) {
      var j = S.ui.dateAjout || S.ui.jour;
      if (el.dataset.v === 'position' && S.ui.typeAjout) { S.ui.feuille = null; ACTIONS.ajouterProches({ dataset: { v: S.ui.typeAjout, d: j, src: 'position' } }); return; }
      if (el.dataset.v === 'position') {
        S.ui.feuille = null;
        Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null }); LS.set('autour', S.ui.autour);
        S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; rendre(); window.scrollTo(0, 0); ACTIONS.localiser();
        return;
      }
      S.ui.feuille = { type: 'ajouterCommunes', titre: 'Communes du ' + dateCourte(j), pleine: true }; rendre();
    },
    ajouterCandidat: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), d = S.ui.dateAjout || S.ui.jour; if (!c) return;
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = el.dataset.r === 'recherche' && fAvant ? fAvant : { type: 'ajouterCommunes', titre: 'Communes du ' + dateCourte(d), pleine: true }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') au ' + dateFr(d) + ' ?', 'Ajouter',
        function () { ajouterArret(c, d); rendre(); }, retourAjout);
    },
    exportPortee: function (el) { S.ui.feuille.portee = el.dataset.v; rendre(); },
    envoyerWhatsapp: function () { window.open(urlWhatsapp(S.ui.feuille.texte), '_blank', 'noopener'); },
    copierTexte: function () { copier(S.ui.feuille.texte); },
    partagerTexte: function () { navigator.share({ title: 'Programme de tournée', text: S.ui.feuille.texte }).catch(function () {}); },
    fermerFeuille: function () {
      var f = S.ui.feuille;
      if (f && f.type === 'listeChoix') { S.ui.feuille = f.retour || null; if (f.dom) rendreFeuille(); else rendre(); return; }
      S.ui.feuille = null; rendre();
    },
    couvPortee: function (el) { S.ui.couvPortee = el.dataset.v; LS.set('couvPortee', S.ui.couvPortee); rendre(); },
    couvOuvrir: function () { S.ui.couvOuverte = !S.ui.couvOuverte; rendre(); },
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
    communesAucune: function () { S.ui.feuille.sel = []; rendre(); },
    communesOk: function () {
      var f = S.ui.feuille;
      if (f.cle === 'tout') S.params.communes = f.sel.slice(); else S.params.communesJour[f.cle] = f.sel.slice();
      if (f.cle === 'tout' && !(S.params.mode === 'semaine' && S.params.parJour)) { S.ui.etapesP.ok.ou = true; sauverEtapesP(); }
      LS.set('params', S.params); S.ui.feuille = null; rendre();
    },
    // À voir absolument
    ouvrirRecherche: function () { S.ui.feuille = { type: 'recherche', titre: 'RDV ou médecin prioritaire', q: '' }; rendre(); var i = $('rechercheImpose'); if (i) i.focus(); },
    choisirImpose: function (el) { S.ui.feuille.code = el.dataset.v; S.ui.feuille.cle = ''; rendre(); },
    retourRecherche: function () { S.ui.feuille.code = null; rendre(); },
    ajouterImpose: function () {
      var f = S.ui.feuille, choix = document.querySelector('input[name=impCle]:checked'), rdv = ($('impRdv').value || '').trim();
      var im = { code: f.code };
      if (choix && choix.value) { var p = choix.value.split('|'); im.date = p[0]; im.cle = p.slice(1).join('|'); }
      if (rdv) im.rdv = rdv;
      S.imposes = S.imposes.filter(function (x) { return x.code !== im.code; }).concat([im]);
      var place = S.plan.length ? placerImpose(im) : false;
      S.ui.feuille = null; sauver(); rendre();
      if (place) publierPlan();
      toast(place ? 'Ajouté à la tournée du ' + dateCourte(S.ui.jour) + '.' : 'Ajouté. Il sera placé à la prochaine proposition de tournée.');
    },
    retirerImpose: function (el) { S.imposes.splice(+el.dataset.i, 1); LS.set('imposes', S.imposes); rendre(); },
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'Ajouter à ma tournée', code: el.dataset.v, cle: '' }; rendre(); },
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
    planifierDateOui: function () {
      var f = S.ui.feuille, c = Moteur.creneauParCle(ctx(), f.cle); S.ui.feuille = null;
      if (c && ajouterArret(c, f.d)) { S.ui.tab = 'jour'; S.ui.jour = f.d; window.scrollTo(0, 0); }
      rendre();
    },
    // Autour de moi
    localiser: function () { localiser(); },
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
      // la fiche s'ouvre là où elle est dans la liste, sans remonter en tête ni déplacer l'écran
      var y = el.getBoundingClientRect().top;
      S.ui.contactEnTete = null; S.ui.contactOuvert = S.ui.contactOuvert === el.dataset.v ? null : el.dataset.v; rendre();
      var b = document.querySelector('[data-a="contact"][data-v="' + (window.CSS && CSS.escape ? CSS.escape(el.dataset.v) : el.dataset.v) + '"]');
      if (b) window.scrollBy(0, b.getBoundingClientRect().top - y);
    },
    filtre: function (el) { S.ui.filtre = el.dataset.v; S.ui.limite = 40; rendre(); },
    plus: function () { S.ui.limite += 40; rendre(); },
    collegue: function (el) {
      // toucher un délégué de la synthèse l'isole (sélection « Choisir »)
      var v = el.dataset.v; S.ui.fq = { qui: 'liste', liste: [v] }; LS.set('filtreQui', S.ui.fq); S.ui.eqOuverts = {}; S.ui.jourEquipe = null; rendre();
    },
    quiOuvrir: function () { S.ui.feuille = { type: 'qui', titre: 'Délégués', qui: S.ui.fq.qui, liste: S.ui.fq.liste.slice() }; rendre(); },
    quiMode: function (el) { var f = S.ui.feuille; f.qui = el.dataset.v; if (f.qui === 'liste' && !f.liste.length && moi()) f.liste = [moi()]; rendre(); },
    quiToggle: function (el) { var f = S.ui.feuille, i = f.liste.indexOf(el.dataset.v); if (i >= 0) f.liste.splice(i, 1); else f.liste.push(el.dataset.v); rendre(); },
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
    sync: function () {
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
    paramPotentiel: function (el) {
      var l = S.params.potentiels, i = l.indexOf(el.dataset.v);
      if (i >= 0) l.splice(i, 1); else l.push(el.dataset.v);
      LS.set('params', S.params); rendre();
    },
    choisirSpecialites: function () {
      S.ui.feuille = { type: 'multi', titre: 'Spécialités ciblées', titreGroupe: 'Spécialités', cle: 'specialites', options: specialitesListe(), sel: S.params.specialites.slice(),
                       aide: 'Aucune sélection = toutes les spécialités. Les pharmacies dépendent du choix « Avec / Sans pharmacies ».' };
      rendre();
    },
    crChoix: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      majCr(a, el.dataset.k, el.dataset.v); validerEtape(a, el.dataset.k); rendre();
    },
    crOk: function (el) { var a = arret(el.dataset.uid); if (!a) return; validerEtape(a, el.dataset.v); rendre(); },
    crPasser: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var champs = { precision: ['precision'], bilan: ['bilan'], commentaire: ['commentaire'], besoin: ['besoinTexte'] }[el.dataset.v] || [];
      champs.forEach(function (k) { majCr(a, k, ''); });
      if (el.dataset.v === 'besoin') crDe(a).besoin = [];
      syncCr(a); validerEtape(a, el.dataset.v); rendre();
    },
    crEditer: function (el) { var a = arret(el.dataset.uid); if (!a) return; editerEtape(a, el.dataset.v); rendre(); },
    crDate: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      majCr(a, 'date', el.dataset.v); validerEtape(a, 'date'); rendre();
    },
    conflitRemplacer: function (el) { remplacerArret(el.dataset.uid); },
    remplacerChoisir: function (el) {
      var cr = Moteur.creneauParCle(ctx(), el.dataset.v); if (!cr) return;
      S.ui.feuille.choix = { cle: el.dataset.v, nom: cr.prat.nom, note: cr.prat.note, heure: el.dataset.h, lieu: cr.lieu, quartier: cr.quartier }; rendre();
    },
    remplacerNon: function () { S.ui.feuille.choix = null; rendre(); },
    remplacerOui: function () { var f = S.ui.feuille; appliquerRemplacement(f.uid, f.choix.cle, f.garder); },
    completerJour: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true }; rendre();
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
      S.ui.filtresAutour = Object.assign(JSON.parse(JSON.stringify(FILTRES_VIDES)), { type: type },
        type === 'Médecin' ? { specialites: (S.params.specialites || []).slice() } : {}); LS.set('filtresAutour', S.ui.filtresAutour);
      S.ui.rechercheAutour = ''; S.ui.rechAutourLibre = '';
      Object.assign(S.ui.autour, j === aujourdhui() ? { moment: 'maintenant', ref: null } : { moment: 'choisir', date: j, heure: '', ref: null });
      LS.set('autour', S.ui.autour);
      S.ui.tab = 'autour'; S.ui.pharmaciesProches = type; rendre(); window.scrollTo(0, 0);
      localiser();
    },
    crMulti: function (el) { var a = arret(el.dataset.uid); if (!a) return; majCr(a, el.dataset.k, el.dataset.v, true); rendre(); },
    crRemplacer: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      syncCr(a); validerVisites(a.uid);
      if (a.hors) return;   // jour passé hors tournée : pas de remplacement après coup
      S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: a.uid, choix: null, garder: true }; rendre();
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
      majCr(a, k, actuel === el.dataset.v && el.dataset.v ? '' : el.dataset.v); rendre();
    },
    listeOuvrir: function (el) {
      var id = el.dataset.liste, cfg = S.ui.listes[id]; if (!cfg) return;
      var val = cfg.dom ? ($(id) || {}).value : cfg.valeur;
      S.ui.feuille = { type: 'listeChoix', titre: cfg.titre, id: id, sel: val || '', retour: S.ui.feuille, dom: cfg.dom };
      if (cfg.dom) rendreFeuille(); else rendre();
    },
    choix: function (el) {
      var c = cheminObjet(el.dataset.chemin), v = el.dataset.v;
      if (el.dataset.m === '1') { var l = c.o[c.k], i = l.indexOf(v); if (i >= 0) l.splice(i, 1); else l.push(v); }
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
    crListeAucun: function () { S.ui.feuille.sel = []; rendre(); },
    crListeOk: function () {
      var f = S.ui.feuille, a = arret(f.uid); S.ui.feuille = null;
      if (a) {
        crDe(a)[f.cle] = f.sel.slice(); syncCr(a); LS.set('plan', S.plan);
        // comme Planifier : la liste validée passe à la question suivante (sauf s'il reste un champ à remplir dans la question)
        if (f.sel.length && (f.cle === 'types')) validerEtape(a, f.cle);
      }
      rendre();
    },
    groupeTout: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k];
      el.closest('.groupe-filtre').querySelectorAll('.puce:not([hidden])').forEach(function (b) { if (l.indexOf(b.dataset.v) < 0) l.push(b.dataset.v); });
      rendre();
    },
    groupeAucun: function (el) { var c = cheminObjet(el.dataset.chemin); c.o[c.k] = []; rendre(); },
    sectionToute: function (el) {
      var c = cheminObjet(el.dataset.chemin), l = c.o[c.k], vs = [];
      el.closest('.section-choix').querySelectorAll('.puce').forEach(function (b) { vs.push(b.dataset.v); });
      var tous = vs.every(function (v) { return l.indexOf(v) >= 0; });
      vs.forEach(function (v) { var i = l.indexOf(v); if (tous && i >= 0) l.splice(i, 1); if (!tous && i < 0) l.push(v); });
      rendre();
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
    multiAucun: function () { S.ui.feuille.sel = []; rendre(); },
    multiOk: function () {
      var f = S.ui.feuille; S.params[f.cle] = f.sel.slice(); LS.set('params', S.params);
      if (f.cle === 'specialites') { S.ui.etapesP.ok.spec = true; sauverEtapesP(); }
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
      var f = S.ui.feuille; majFiltres(f.brouillon);
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
    nouvelleFiche: function () { S.ui.feuille = { type: 'fiche', titre: 'Nouveau praticien', pleine: true, etape: 0, d: brouillonFiche(''), err: {} }; rendre(); },
    modifierFiche: function (el) { var d = brouillonFiche(el.dataset.v); S.ui.feuille = { type: 'fiche', titre: 'Modifier la fiche', pleine: true, etape: 0, d: d, err: {}, initial: JSON.stringify(d) }; rendre(); },
    ficheVal: function (el) {
      var d = S.ui.feuille.d, k = el.dataset.k;
      d[k] = k === 'note' ? +el.dataset.v : el.dataset.v;
      rendre();
    },
    ficheJour: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i], j = l.jours[+el.dataset.j];
      j[el.dataset.c] = !j[el.dataset.c];
      if (S.ui.feuille.err['jours' + el.dataset.i]) S.ui.feuille.err = erreursEtape(S.ui.feuille.d, 2);
      rendre();
    },
    ficheAjouterLieu: function () { S.ui.feuille.d.lieux.push(lieuVide()); rendre(); },
    ficheRetirerLieu: function (el) { S.ui.feuille.d.lieux.splice(+el.dataset.i, 1); S.ui.feuille.err = {}; rendre(); },
    ficheChoixLieu: function (el) {
      var f = S.ui.feuille, i = +el.dataset.i, e = ((S.ui.sugLieux || {})[i] || [])[+el.dataset.v]; if (!f || !e) return;
      var l = f.d.lieux[i]; l.lieu = e.lieu; delete f.err['lieu' + i];
      // le quartier et la position suivent l'établissement choisi (modifiables à l'étape Lieux)
      if (e.quartier && quartiers().some(function (q) { return q.quartier === e.quartier; })) l.quartier = e.quartier;
      if (e.lat && !l.lat) { l.lat = e.lat; l.lon = e.lon; }
      rendre(); toast('Établissement repris : ' + e.lieu + '.');
    },
    ficheGps: function (el) {
      var l = S.ui.feuille.d.lieux[+el.dataset.i];
      if (!navigator.geolocation) { toast('La localisation n\'est pas disponible sur cet appareil.'); return; }
      toast('Recherche de votre position précise…');
      // 3.25.9 : mesure fraîche et précise ; elle prévaut sur la position de la base et l'écrase à l'enregistrement
      mesurePrecise(function (p) {
        var avant = l.lat && l.lon ? { lat: parseFloat(String(l.lat).replace(',', '.')), lon: parseFloat(String(l.lon).replace(',', '.')) } : null;
        l.lat = +p.lat.toFixed(6); l.lon = +p.lon.toFixed(6);
        var r = Moteur.quartierLePlusProche(l.lat, l.lon, quartiers());
        if (r && !l.quartier) l.quartier = r.quartier.quartier;
        var ecart = avant && isFinite(avant.lat) ? distanceVol(avant, { lat: l.lat, lon: l.lon }) : 0;
        rendre();
        toast('Position prise sur place (± ' + p.prec + ' m)' + (ecart > 0.02 ? ' : elle remplacera celle de la base (écart ' + distanceCourte(ecart) + ')' : '') + '. Enregistrez pour valider.' +
          (p.prec > 60 ? ' Précision faible : activez la localisation précise.' : ''));
      }, function () { toast('Position indisponible. Autorisez la localisation.'); });
    },
    ficheGpsEffacer: function (el) { var l = S.ui.feuille.d.lieux[+el.dataset.i]; l.lat = ''; l.lon = ''; rendre(); },
    ficheAller: function (el) { var f = S.ui.feuille; f.err = {}; f.etape = Math.min(f.etape, +el.dataset.v); rendre(); },
    ficheEtape: function (el) {
      var f = S.ui.feuille, sens = +el.dataset.v;
      if (sens > 0) {
        f.err = erreursEtape(f.d, f.etape);
        if (Object.keys(f.err).length) { rendre(); focusErreur(); toast('Corrigez les champs signalés.'); return; }
      } else f.err = {};
      f.etape = Math.max(0, Math.min(3, f.etape + sens));
      rendre();
      var c = document.querySelector('.feuille-corps'); if (c) c.scrollTop = 0;
    },
    ficheEnregistrer: function () {
      var f = S.ui.feuille;
      for (var i = 0; i < 4; i++) {
        var e = erreursEtape(f.d, i);
        if (Object.keys(e).length) { f.etape = i; f.err = e; rendre(); focusErreur(); toast('Étape ' + (i + 1) + ' à compléter.'); return; }
      }
      if (f.initial && f.initial === JSON.stringify(f.d)) { S.ui.feuille = null; rendre(); toast('Aucune modification : la fiche est inchangée.'); return; }
      var nouveau = !f.d.code, code = enregistrerFiche(f.d);
      S.ui.feuille = null; S.ui.contactOuvert = code; S.ui.contactEnTete = code; S.ui.tab = 'praticiens'; S.ui.recherche = ''; rendre();
      toast((nouveau ? 'Praticien ajouté' : 'Fiche mise à jour') + (S.config.demo ? '.' : (navigator.onLine ? ', envoi au Google Sheet…' : ', envoyée dès le retour du réseau.')));
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

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-a]');
    if (!el || !ACTIONS[el.dataset.a] || el.disabled) return;
    if (el.tagName === 'A') return;
    e.preventDefault();
    ACTIONS[el.dataset.a](el, e);
  });
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f, pos;
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'cr') { var ac = arret(el.dataset.uid); if (ac) majCr(ac, el.dataset.k, el.value); }
    if (f === 'fiche') {
      majChampFiche(el, false);
      if (el.dataset.k === 'lieu') { var zs = document.getElementById('sugLieu' + el.dataset.i); if (zs) zs.innerHTML = suggestionsLieu(el.value, +el.dataset.i); }
    }
    if (f === 'produits') {
      var ap = arret(el.dataset.uid), ref = ap ? produitsPour(ap) : produitsRef();
      if (ap) { ap.produits = listeProduits(ap.produits).filter(function (x) { return ref.indexOf(x) >= 0; }).concat(listeProduits(el.value)).join(', '); LS.set('plan', S.plan); }
    }
    if (f === 'rechCommunes' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zc = document.getElementById('resCommunes'); if (zc) zc.innerHTML = resultatsCommunes(el.value);
    }
    if (f === 'rechAutourLibre') {
      S.ui.rechAutourLibre = el.value; var za = document.getElementById('resAutourLibre'), zl = document.getElementById('autourListe');
      if (za) za.innerHTML = resultatsAutourLibre(el.value); if (zl) zl.hidden = !!normaliser(el.value);
    }
    if (f === 'rechAjout' && S.ui.feuille) {
      S.ui.feuille.q = el.value; var zr = document.getElementById('resAjout'); if (zr) zr.innerHTML = resultatsAjout(el.value);
    }
    if (f === 'chercheOption') {
      var fe = S.ui.feuille; fe.q = fe.q || {}; fe.q[el.dataset.g] = el.value;
      var q = normaliser(el.value), g = el.closest('.groupe-filtre');
      g.querySelectorAll('.puce').forEach(function (b) { b.hidden = !!q && b.dataset.lib.indexOf(q) < 0; });
      g.querySelectorAll('.section-choix').forEach(function (sec) { sec.hidden = !sec.querySelector('.puce:not([hidden])'); });
    }
    if (f === 'jourDate' && el.value) { allerAuJour(el.value); return; }
    if (f === 'rapport') { var Rr = rapportOuCree(jourAffiche()); Rr[el.dataset.k] = el.value; sauverRapports(); return; }
    if (f === 'rechProduit') {
      S.ui.rechProduit = el.value; var pp = el.selectionStart; rendre();
      var cp = document.querySelector('[data-f="rechProduit"]'); if (cp) { cp.focus(); try { cp.setSelectionRange(pp, pp); } catch (x) {} }
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
    if (i !== undefined) d.lieux[+i][k] = v; else d[k] = v;
    if (!change) return;
    if (k === 'specialite' || k === 'quartier') {
      // liste déroulante : nouvel affichage (champ « Autre », commune), en gardant les erreurs déjà signalées
      var tous = erreursEtape(d, f.etape), cleS = k === 'quartier' ? 'quartier' + i : 'specialite', garde = {};
      Object.keys(f.err).forEach(function (x) { if (tous[x]) garde[x] = tous[x]; });
      if (tous[cleS]) garde[cleS] = tous[cleS];
      f.err = garde; rendre(); return;
    }
    var cle = { lieu: 'lieu', horaireMatin: 'hm', horaireSoir: 'hs' }[k];
    cle = cle ? cle + i : k;
    var err = erreursEtape(d, f.etape)[cle] || '';
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

  // ------------------------------------------------------------------ Icônes
  function icone(n) {
    var d = {
      relancer: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      pieton: '<circle cx="13" cy="4" r="1.8"/><path d="M10 21l2-6 3 3v3M9 11l3-3.5 3 2 2.5 3M12 7.5l-1.3 5.3 3.3 2.2"/><path d="M8.5 12.5 7 15"/>',
      voiture: '<path d="M5 16V12l1.8-4.2A2 2 0 0 1 8.6 6.5h6.8a2 2 0 0 1 1.8 1.3L19 12v4"/><path d="M4 16h16v2.5H4z"/><path d="M5 12h14"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
      medecin: '<path d="M12 2.5v19"/><path d="M14.6 4.2c1.3.2 1.6 1.6.4 2.2L9.4 9c-1.6.8-1.4 2.6.3 3.1l4.4 1.2c1.6.5 1.7 2.3.2 3l-3.5 1.6"/><circle cx="14.6" cy="4.1" r=".6"/>',
      pharmacie: '<path d="M5 10.5h14c0 3.6-3.1 6.5-7 6.5s-7-2.9-7-6.5z"/><path d="M12 17v3.5M8.5 21h7"/><path d="M8.5 10.5c-.4-2.3 1.2-3.4 3.3-3.4s3.3-1.2 2.7-3.1"/><circle cx="14.4" cy="3.9" r=".6"/>',
      equipe: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.7.8 2.8 2.6 3 5.2"/>',
      partager: '<path d="M12 3v12"/><path d="m8 7 4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>',
      telecharger: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
      fermer: '<path d="M6 6l12 12M18 6 6 18"/>',
      epingle: '<path d="M9 3h6l-1 6 4 4H6l4-4-1-6Z"/><path d="M12 13v8"/>',
      carte: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>',
      cible: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
      loupe: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
      valider: '<path d="M5 12.5 10 17 19 7"/>',
      whatsapp: '<path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 19L4 20Z"/><path d="M9.2 8.6c.2 2.6 2.4 5 5.2 5.4l1.1-1.3-1.8-.9-.8.8c-1-.4-1.9-1.3-2.3-2.3l.8-.8-.9-1.8-1.3.9Z"/>',
      tel: '<path d="M5 4h3.5l1.5 4-2 1.3a10 10 0 0 0 5.7 5.7L15 13l4 1.5V18a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/>',
      sms: '<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9.5h8M8 12.5h5"/>',
      waze: '<path d="M12 3 20 20l-8-4-8 4 8-17Z"/>',
      route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8 18h6a3.5 3.5 0 0 0 0-7h-4a3.5 3.5 0 0 1 0-7h6"/>',
      filtre: '<path d="M4 6h16M7 12h10M10 18h4"/>',
      chevron: '<path d="m6 9 6 6 6-6"/>',
      calendrier: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
      crayon: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'
    }[n] || '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  // ------------------------------------------------------------------ Démarrage
  window.addEventListener('online', function () { synchroniser(true); });
  window.addEventListener('offline', function () { S.ui.sync = 'horsligne'; afficherEntete(); });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.ui.installEvt = e; if (S.ui.tab === 'reglages') rendre(); });
  // 3.25.7 : à chaque ouverture (ou rafraîchissement) de l'application sur « Autour de moi », la position est recalculée
  setTimeout(relocaliserSiBesoin, 0);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    relocaliserSiBesoin();
    var age = S.data && S.data.syncedAt ? Date.now() - new Date(S.data.syncedAt).getTime() : Infinity;
    if (enAttente() || age > 10 * 60 * 1000) synchroniser(true);
    else rafraichirEquipe().then(function (ok) { if (ok) rendreSiPossible(); });
  });
  // Tournées de l'équipe rafraîchies chaque minute quand l'application est ouverte
  setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if (enAttente() || S.ui.aPublier) { synchroniser(true); return; }
    rafraichirEquipe().then(function (ok) { if (ok && !S.ui.feuille) rendreSiPossible(); });
  }, 60000);

  // ------------------------------------------------------------------ Thème
  function appliquerTheme(t) {
    LS.set('theme', t);
    if (t === 'clair' || t === 'sombre') document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    majCouleurBarre();
  }
  function majCouleurBarre() {
    var m = document.querySelector('meta[name=theme-color]'); if (!m) return;
    var sombre = document.documentElement.dataset.theme === 'sombre' ||
      (!document.documentElement.dataset.theme && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    m.setAttribute('content', sombre ? '#0B1E2C' : '#0B4F6C');
  }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', majCouleurBarre); } catch (e) {}
  majCouleurBarre();

  // ------------------------------------------------------------------ Écran de lancement
  function rendreLancement() {
    var el = $('lancement');
    if (!S.ui.lancement) { el.hidden = true; el.innerHTML = ''; return; }
    var etat, detail = '';
    if (S.config.demo) etat = ['demo', 'Mode démonstration'];
    else if (!pret()) etat = ['aucune', 'Aucune base connectée'];
    else if (S.ui.sync === 'erreur' || !navigator.onLine || S.ui.sync === 'horsligne') etat = ['local', 'Hors ligne : données locales'];
    else etat = ['ok', 'Base de données opérationnelle'];
    if (pret() && S.data.syncedAt) detail = 'Synchro ' + new Date(S.data.syncedAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    // 3.25.0 : accueil plein écran, sans décompte ; ouverture après 2 s, ou tout de suite d'un toucher
    var h = '<div class="lancement moderne" role="dialog" aria-modal="true" aria-labelledby="titreLancement">' +
      '<div class="lancement-tete"><div class="logo-halo"><img src="icon-192.png" alt=""></div><h1 id="titreLancement">MediPlanner</h1>' +
      '<p>Tournées médicales, planning des praticiens et suivi d\'équipe</p>' +
      '<span class="version">v' + APP_VERSION + '</span></div><div class="lancement-corps">' +
      '<div class="etat-base ' + etat[0] + '">' + etat[1] + (detail ? '<small>' + esc(detail) + '</small>' : '') + '</div>';
    if (pret()) {
      var prat = ctx().prat, nMed = 0, nPha = 0;
      Object.keys(prat).forEach(function (k) { if (prat[k].type === 'Pharmacie') nPha++; else nMed++; });
      var l = lundiDe(semaineParDefaut(aujourdhui())), f = ajouterJours(l, 6);   // à partir du jeudi : semaine suivante
      var pf = prochainFerie();
      var sem = arretsPlanifies(true).filter(function (a) { return a.date >= l && a.date <= f; });
      var del = {}; sem.forEach(function (a) { if (a.delegue) del[a.delegue] = true; });
      var vus = visitesConnues().filter(function (v) { return String(v.date).slice(0, 10) >= lundiDe(aujourdhui()) && Moteur.estVisite(v.statut, statuts()); }).length;
      h += '<div class="metriques">' +
        '<div class="metrique"><b>' + nMed + '</b><span>médecins enregistrés</span></div>' +
        '<div class="metrique"><b>' + nPha + '</b><span>pharmacies</span></div>' +
        '<div class="metrique"><b>' + sem.length + '</b><span>visites planifiées, semaine du ' + dateCourte(l).slice(5) + (S.config.demo ? '' : ' (équipe)') + '</span></div>' +
        '<div class="metrique"><b>' + (S.config.demo ? vus : Object.keys(del).length) + '</b><span>' + (S.config.demo ? 'visites réalisées cette semaine' : 'délégués avec une tournée') + '</span></div></div>' +
        (pf ? '<p class="discret" style="margin:-6px 0 14px">Prochain jour férié : <b>' + esc(nomFerie(pf)) + '</b>, ' + dateLongue(pf) + '.</p>' : '');
    }
    if (S.ui.nouveautes && S.ui.nouveautes.length) {
      h += '<div class="nouveautes"><b>Nouveautés de la mise à jour ' + APP_VERSION + '</b><ul>' + S.ui.nouveautes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>';
    }
    h += '<p class="lancement-astuce">Touchez l\'écran pour ouvrir</p>';
    h += pret() ? '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>' +
        '<button class="bouton" type="button" data-a="fermerLancement" data-tab="bilan" style="margin-top:10px">Voir mon bilan</button>'
      : '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>';
    el.innerHTML = h + '</div></div>';
    el.hidden = false;
    if (pret() && S.ui.lancementAuto) demarrerDecompte();
  }
  // Lancement automatique : l'écran d'accueil se ferme seul et ouvre la tournée.
  // Un toucher sur l'écran d'accueil arrête le décompte.
  var minuteurLancement = null;
  function demarrerDecompte() {
    if (minuteurLancement) return;
    var total = S.ui.lancementFin - Date.now();
    minuteurLancement = setInterval(function () {
      if (!S.ui.lancement || !S.ui.lancementAuto) { clearInterval(minuteurLancement); minuteurLancement = null; return; }
      var reste = S.ui.lancementFin - Date.now();
      if (reste <= 0) {
        clearInterval(minuteurLancement); minuteurLancement = null;
        S.ui.lancement = false; S.ui.lancementAuto = false;
        S.ui.tab = 'jour';   // le lancement ouvre toujours « Aujourd'hui »
        rendre(); window.scrollTo(0, 0);
      }
    }, 200);
  }
  function arreterDecompte() {
    if (!S.ui.lancementAuto) return;
    S.ui.lancementAuto = false;
    var d = document.querySelector('#lancement .decompte'); if (d) d.remove();
  }
  // un toucher sur l'accueil (hors boutons) ouvre l'application tout de suite
  document.addEventListener('click', function (e) {
    if (!S.ui.lancement || !e.target.closest || !e.target.closest('#lancement') || e.target.closest('[data-a]')) return;
    S.ui.lancement = false; S.ui.lancementAuto = false; S.ui.tab = 'jour'; rendre(); window.scrollTo(0, 0);
  });

  // ------------------------------------------------------------------ Mises à jour (service worker)
  // Une nouvelle version s'installe en arrière-plan puis attend : le bandeau propose « Mise à jour ».
  // Accepter : le nouveau service worker prend la main, la page se recharge, les données locales restent.
  var swReg = null, majDemandee = false;
  function proposerMaj() {
    if (!swReg || !swReg.waiting) return;
    fetch('version.json?_=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.json(); }).catch(function () { return null; }).then(function (v) {
      var b = $('bandeauMaj');
      b.innerHTML = '<div class="contenu"><div class="texte"><b>Mise à jour disponible' + (v && v.version ? ' : v' + esc(v.version) : '') + '</b>' +
        (v && v.notes && v.notes.length ? '<ul>' + v.notes.slice(0, 3).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
          : 'Une nouvelle version de MediPlanner est prête. Vos données sont conservées.') +
        '</div><div class="boutons"><button class="bouton bouton-plein" type="button" data-a="appliquerMaj">Mise à jour</button>' +
        '<button class="bouton-texte" type="button" data-a="plusTardMaj">Plus tard</button></div></div>';
      b.hidden = false;
    });
  }
  function appliquerMaj() {
    sauver();                                   // tout est déjà dans le stockage local ; par sécurité
    majDemandee = true;
    $('bandeauMaj').hidden = true;
    toast('Mise à jour en cours…');
    if (swReg && swReg.waiting) swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else location.reload();
    setTimeout(function () { location.reload(); }, 5000);
  }
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    var controleurInitial = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!controleurInitial && !majDemandee) return;    // première installation : rien à recharger
      if (window.__rechargement) return;
      window.__rechargement = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
      swReg = reg;
      if (reg.waiting && navigator.serviceWorker.controller) proposerMaj();
      reg.addEventListener('updatefound', function () {
        var w = reg.installing; if (!w) return;
        w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) proposerMaj(); });
      });
      setInterval(function () { reg.update().catch(function () {}); }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') reg.update().catch(function () {}); });
    }).catch(function () {});
  }

  // Lien d'installation : #config=<base64 de {"url","token"}> (jamais envoyé au serveur)
  function lireConfigLien() {
    var m = location.hash.match(/config=([A-Za-z0-9_\-]+)/);
    if (!m) return false;
    try {
      var cfg = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (!cfg.url || !cfg.token) return false;
      if (S.config.demo || S.config.url !== cfg.url) {
        S.plan = []; S.jours = {}; S.queue = S.config.url === cfg.url ? S.queue : []; S.data = null; S.imposes = []; S.rejetes = {};
      }
      S.config.url = cfg.url; S.config.token = cfg.token; S.config.demo = false;
      sauver();
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch (e) { return false; }
  }
  function lienInstallation() {
    var json = JSON.stringify({ url: S.config.url, token: S.config.token });
    var b64 = btoa(unescape(encodeURIComponent(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return location.origin + location.pathname + '#config=' + b64;
  }

  var configureParLien = lireConfigLien();
  chargerFeriesCalendrier();
  try { if (!sessionStorage.getItem('mediplanner.lancement')) { S.ui.lancement = true; sessionStorage.setItem('mediplanner.lancement', '1'); } }
  catch (e) { S.ui.lancement = true; }
  // Nouveautés : celles des versions publiées depuis la dernière ouverture, affichées une seule fois
  (function () {
    var vue = LS.get('versionVue', '');
    if (vue === APP_VERSION) return;
    // après une mise à jour : retour sur « Aujourd'hui »
    if (vue) { S.ui.tab = 'jour'; S.ui.pharmaciesProches = false; LS.set('onglet', 'jour'); }
    if (pret() || vue) {
      var notes = [];
      JOURNAL.forEach(function (v) { if (compVersion(v[0], vue) > 0 && compVersion(v[0], APP_VERSION) <= 0) notes = notes.concat(v[1]); });
      S.ui.nouveautes = notes;
      if (notes.length) S.ui.lancement = true;   // après une mise à jour, l'accueil s'affiche même dans la même session
    }
    LS.set('versionVue', APP_VERSION);
  })();
  if (S.ui.lancement && !(S.ui.nouveautes && S.ui.nouveautes.length)) {   // après une mise à jour : pas de décompte, on lit tranquillement
    S.ui.lancementAuto = true;
    S.ui.lancementFin = Date.now() + 1000 * (S.ui.nouveautes && S.ui.nouveautes.length ? DELAI_LANCEMENT_NOUVEAUTES : DELAI_LANCEMENT);
  }
  // 3.24.5 : « Pharmacie » abrégé en « Phcie » à l'écran seulement (cartes, listes, feuilles, messages).
  // On ne touche qu'aux textes affichés : ni les valeurs des champs, ni les attributs, ni les données,
  // ni les textes partagés (WhatsApp, exports) ; les lecteurs d'écran gardent le mot entier (aria-label).
  (function () {
    var RE = /\bPharmacie\b|\bPHARMACIE\b/g, EXCLUS = { TEXTAREA: 1, SCRIPT: 1, STYLE: 1, OPTION: 1, INPUT: 1, SELECT: 1 };
    function abreger(n) {
      if (n.nodeType === 3) {
        var p = n.parentNode; if (!p || EXCLUS[p.nodeName] || (p.closest && p.closest('[contenteditable],textarea,select,.texte-entier'))) return;
        if (RE.test(n.nodeValue)) { RE.lastIndex = 0; n.nodeValue = n.nodeValue.replace(RE, function (m) { return m === 'PHARMACIE' ? 'PHCIE' : 'Phcie'; }); }
        RE.lastIndex = 0; return;
      }
      if (n.nodeType !== 1 || EXCLUS[n.nodeName]) return;
      var w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), l = [], t;
      while ((t = w.nextNode())) l.push(t);
      l.forEach(abreger);
    }
    if (!window.MutationObserver) return;
    abreger(document.body);
    new MutationObserver(function (ms) {
      ms.forEach(function (m) { if (m.type === 'characterData') abreger(m.target); else m.addedNodes.forEach(abreger); });
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  })();
  // 3.24.9 : les jours écartés d'office par les versions précédentes reviennent dans l'agenda
  if (!LS.get('retiresV2', false)) { LS.set('joursRetires', {}); LS.set('retiresV2', true); }
  importerAgenda();
  // 3.19.0 : à l'ouverture, Journée montre toujours aujourd'hui
  (function () {
    var t = aujourdhui();
    if (datesPlan().indexOf(t) >= 0) { S.ui.jour = t; S.ui.jourVue = null; } else { S.ui.jourVue = t; }
  })();
  rendre();
  if (configureParLien) toast('Application configurée. Synchronisation…');
  if (connecte()) synchroniser(!configureParLien).then(function () {
    if (configureParLien && pret()) { S.ui.tab = S.plan.length ? 'jour' : 'semaine'; rendre(); }
  });

  // Accès pour les tests automatisés
  window.__tournees = { S: S, ctx: ctx, actualiserLieux: actualiserLieux, texteProgramme: texteProgramme, texteRapport: texteRapport, urlWhatsapp: urlWhatsapp, normaliserNumero: normaliserNumero,
                        version: APP_VERSION, calculerStats: calculerStats, filtrerPraticiens: filtrerPraticiens, erreursEtape: erreursEtape, rendre: rendre };
})();
