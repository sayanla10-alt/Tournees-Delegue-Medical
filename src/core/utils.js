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

  var APP_VERSION = '3.28.4';
  // Nouveautés par version : l'écran d'accueil affiche, une seule fois, celles des versions
  // publiées depuis la dernière ouverture du téléphone
  var JOURNAL = [
    ['3.27.50', [
      'Modularisation intégrale de l\'architecture (19 composants indépendants) : découpage strict de toutes les vues et moteurs pour éliminer tout risque de régression',
      'Mode Clôture de journée (après 18h30) : synthèse valorisante de fin de tournée (« X visites sur Y réalisées, Z comptes-rendus à synchroniser ») et encouragement terrain',
      'Planning (Suppression de date) : Jauge visuelle circulaire sous le doigt et vibration haptique (50 ms) lors de l\'appui long de 650 ms (retour sensoriel immédiat)',
      'Auto-recovery Service Worker : Rétablissement et auto-recovery du Service Worker (mise à jour immédiate et résilience)',
      'Concurrence non-destructive (Field-Level Merge) : fusion intelligente par champ lors des mises à jour de fiches (préservation des données des collègues et fin des écrasements aveugles)',
      'Trafic Abidjan & Lagune réaliste : pénalité de franchissement des ponts ajustée à 45 min aux heures de pointe (7h30-9h30 et 16h30-19h30) pour des tournées réalisables sur le terrain',
      'Traçabilité complète (Audit Trail) : création de la feuille Audit_Logs consignant chaque modification avec auteur, horodatage, ancienne et nouvelle valeur, sans suppression sèche',
      'Performance DOM & Infinite Scroll : affichage progressif et défilement infini sans saccade dans le Répertoire (fin du DOM bloat)',
      'Résilience hors-ligne (Dead-Letter Queue) : isolation unitaire des fiches et visites en file d\'attente (fin du blocage en tête de file)',
      'Régulation batterie GPS : cache de position 3 min et limitation du GPS haute précision pour préserver la batterie'
    ]],
    ['3.27.46', [
      'Stockage flash IndexedDB : migration intégrale du stockage local hors-ligne vers IndexedDB (zéro saturation de quota, suppression du plafond de 5 Mo et fin des saccades synchrones)',
      'Synchronisation incrémentale Delta (syncedAt) : transmission ultra-légère des seules modifications réelles, synchro instantanée et résilience maximale en mobilité 3G/4G'
    ]],
    ['3.27.45', ['Journée (+ Médecin / + Pharmacie) : remplacement du conteneur déformé de « Près de moi » par le format compact et aligné à droite du bouton Itinéraire (sans étirement), rétablissement de l’icône cible']],
    ['3.27.44', [
      'Répertoire : affichage et tri par défaut par ordre alphabétique strict de A à Z (Médecins, Pharmacies et Hôpitaux)',
      'CR visite (Médecin) : ordre des produits rigoureusement conforme à la BDD (Zyltan 50, AM, H, Losartan AM ; Lesstrol 10, 20, AM, EZ ; Tensicard 50, AM ; puis Eurythmic)',
      'Fiches praticiens : forçage du formatage téléphonique international strict +225 07 47 27 55 38 à l’enregistrement et dans la BDD',
      'Journée (+ Médecin / + Pharmacie) : icônes et harmonisation complètes des choix d’ajout'
    ]],
    ['3.27.43', ['Interface : remplacement de l’icône cible par la version miroir de l’icône itinéraire pour « Près de moi », « Autour de moi » et les repères de position']],
    ['3.27.42', ['Journée (+ Médecin / + Pharmacie) : 4e choix « Tout le répertoire » pour afficher tous les médecins ou pharmacies de la base sans filtre ni restriction']],
    ['3.27.41', ['Synchronisation temps réel : prise en compte immédiate des ajouts de médecins et des modifications de plannings par les collègues au rafraîchissement']],
    ['3.27.40', ['Répertoire (Hôpitaux) : fiabilisation de la capture GPS (synchronisation temps réel avec la base, sauvegarde garantie des coordonnées des établissements et affichage immédiat « Sur place »)']],
    ['3.27.39', ['Répertoire (Hôpitaux) : la capture GPS actualise instantanément la position du délégué (« Sur place » immédiat et recalcul des distances de tous les établissements)']],
    ['3.27.38', ['Autour de moi / Journée : récupération automatique de la position GPS et déduction du quartier par défaut', 'Changement dynamique : sélection d’un quartier recalculant immédiatement les praticiens selon ce paramètre']],
    ['3.27.37', ['Répertoire (Médecins) : statut de visite remplacé par la présence temps réel (« Présent » en vert si en consultation à l’instant T, « Absent » en rouge sinon)']],
    ['3.27.33', ['Sélecteur de quartiers : Communes classées de A à Z par ordre alphabétique strict, villes de l’intérieur en dernier', 'Cocody, Yopougon, Abobo : Découpage hiérarchique clair par sous-secteur avec quartiers classés de A à Z', 'Synchronisation BDD : Prise en compte immédiate des modifications de la feuille Quartiers de la base de données']],
    ['3.27.32', ['Répertoire : nombres sans parenthèses, Recherche / Ajouter / Modifier à la hauteur de « Réinitialiser les filtres », spécialité en gras (Médecins et Hôpitaux)']],
    ['3.27.31', ['Répertoire : sélecteur Médecins / Pharmacies / Hôpitaux sur une seule ligne, nombre entre parenthèses']],
    ['3.27.30', ['Répertoire : trois annuaires en haut (Médecins, Pharmacies, Hôpitaux)', 'Hôpitaux : du plus proche au plus loin, avec le nombre de médecins, ceux vus ce mois et présents aujourd’hui ; la carte ouverte liste les médecins de l’établissement avec leurs jours et « Planifier »']],
    ['3.27.29', ['Journée : « Praticien indisponible ? Trouver un remplaçant. » dans un encadré ajusté au texte']],
    ['3.27.28', ['Nouveau médecin ou pharmacie : noms existants proposés dès 3 lettres (débuts de mots en premier)', 'Nom proche déjà présent dans le même établissement (ou pharmacie proche à moins de 150 m) : signalé et confirmation demandée', 'Même établissement saisi deux fois sur une fiche : regroupé en un seul lieu', 'Fiche rattachée à une fiche existante : les lieux s’ajoutent sans effacer ceux déjà connus']],
    ['3.27.27', ['Autour de moi : la barre de recherche des Hôpitaux, des Spécialités et de la Zone (pharmacies) reste visible même groupe replié ; taper ouvre le groupe']],
    ['3.27.26', ['Spécialités : « Médecine générale » regroupée avec MG, Pneumo et Infectio abrégés', 'Rafraîchir la page garde l’onglet (y compris Réglages), la carte ouverte et la position de lecture']],
    ['3.27.25', ['Synchronisation beaucoup plus rapide : à l’ouverture, une simple vérification (environ 1 s) quand la base n’a pas changé ; sinon la base complète arrive d’un cache préparé par le serveur']],
    ['3.27.24', ['Journée : « Finaliser le compte rendu » disparaît dès que le compte rendu du jour est validé, y compris s’il l’a été depuis un autre appareil']],
    ['3.27.23', ['Répertoire : la prochaine présence tient compte de l’heure (aujourd’hui jusqu’à la fermeture, puis la suivante)', 'Répertoire : « Planifier » propose aujourd’hui, demain et les présences suivantes, avec les conflits signalés', 'Compte rendu non finalisé à 18 h 30 : notification du téléphone', 'Compte rendu : « Échantillons remis » sur Non par défaut']],
    ['3.27.22', ['Planifier et Journée : les repères du lieu (colonne Repères, ex. « Enceinte CHU Treichville, Blvd de Marseille ») s’affichent comme dans le Répertoire']],
    ['3.27.21', ['Journée : l’application restée ouverte depuis la veille repasse seule sur la date du jour', 'Erreur d’affichage : le détail technique est affiché pour diagnostic']],
    ['3.27.20', ['Base des présences vérifiée avec le cerveau terrain : 868 présences confirmées, doublons de lieux fusionnés, noms d’établissements harmonisés']],
    ['3.27.19', ['Fiche : les infirmiers (IDE) et sages-femmes (SAG) ne reçoivent plus « Dr » devant leur nom']],
    ['3.27.18', ['Établissements : « 2 Pltx », « St », « CSU-COM » reconnus comme le nom officiel (pas de doublon de lieu)', 'Doublon de praticien : le code existant est affiché, avec « Compléter sa fiche »']],
    ['3.27.17', ['CR pharmacie, étape 3 : « Retour » retiré ; les activités se rangent au plus serré (3 par ligne)']],
    ['3.27.16', ['Semaine type (Répertoire et fiche) : couleur fixe par établissement, la même chez tous les délégués : 1 vert, 2 bleu, puis violet, orange, rose, sarcelle, brun, indigo, olive, ardoise (10 établissements)']],
    ['3.27.15', ['CR pharmacie : PLV remplacé par MEP ; plus de coche sur les choix sélectionnés (déjà en couleur) ; stock par produit sans quantité ; « Commande passée ? » sur Non par défaut, Oui ouvre « Besoin de réapprovisionnement » (facultatif)']],
    ['3.27.14', ['Journée : la carte Rappel s’ouvre au toucher ; pour chaque rappel : Appeler, Ajouter au jour, Demain (report) ou Fait (retiré) ; plusieurs rappels tiennent dans une seule carte']],
    ['3.27.13', ['Journée : une visite ajoutée aujourd’hui n’a plus d’heure déjà passée ; si le créneau du matin est terminé, celui du soir est pris']],
    ['3.27.12', ['Journée : carte Rappel à la même hauteur que la carte Compte Rendu ; « Autour de moi » n’est plus coupé dans la barre du bas']],
    ['3.27.11', ['Synchronisation : la base est vérifiée chaque minute quand l’application est ouverte, et relue à chaque retour dans l’application ; les corrections faites dans le Google Sheet apparaissent sans attendre', 'Noms, spécialités et potentiels corrigés dans la base : repris aussi sur les visites déjà faites']],
    ['3.27.10', ['Journée : + Médecin, + Pharmacie et Autour de moi figés en bas, à la taille des boutons de Planifier', 'Journée : bouton Remplacer centré', 'Planifier : date, nombre de visites et ligne de détail centrées']],
    ['3.27.9', ['Défilement automatique : les options suivantes se placent toujours là où l’écran a été touché en dernier, sans l’exception qui gardait l’intitulé visible']],
    ['3.27.8', ['CR pharmacie, étape 5 : « Aucune » et « Périmé » sur la même ligne, « Proche péremption » en dessous']],
    ['3.27.7', ['Répertoire : boutons Appeler, SMS, WhatsApp, Maps et ligne « Tél » comme avant ; « Modifier le planning hebdomadaire » de retour en bas ; étiquettes des cartes sur une seule ligne tant que possible']],
    ['3.27.6', ['Répertoire, fiche dépliée : prochaine présence en tête (avec Planifier) ; numéro et 4 boutons de contact sur une ligne ; une seule semaine pour tous les lieux en petits carrés M / S à la couleur du lieu, légende dessous ; « Planning » à côté du titre']],
    ['3.27.5', ['Fiche : seules les spécialités du cœur de cible sont affichées ; les autres restent repliées, même en modification (la spécialité choisie s’affiche sur le bouton)']],
    ['3.27.4', ['Ajouter : « Créer » mène à 1. Qui puis 2. Où et quand ; plus de choix Médecin / Pharmacie après « Créer » ; Suivant vérifie l’étape ; Enregistrer en bas, en fin de parcours', '« Dr » ajouté au nom d’un médecin sans titre, « Pharmacie » au nom d’une officine qui ne le précise pas ; potentiel à 1 étoile par défaut', 'Spécialités : cœur de cible affiché, les autres en dépliant ; établissement connu : quartier, repères et GPS repris', 'Journée : carte d’une visite non réalisée en rouge léger (comme le vert léger des visites faites)']],
    ['3.27.3', ['Fiche, mode sombre : texte des cases « Oui » et de « C’est ici » lisible']],
    ['3.27.2', ['Fiche : retour de tout ce qui existait avant (M / S pour cocher toute la ligne, GPS de la pharmacie affiché avec ✕, commune sous le quartier, spécialités groupées, téléphone dans les doublons, choix Médecin / Pharmacie tant que la fiche est nouvelle, titre « Planning hebdomadaire »)']],
    ['3.27.1', ['Fiche contact repensée : « + Ajouter » commence par chercher la personne rencontrée (contacts existants à ouvrir, sinon Créer) ; pharmacies connues autour de vous', '1. Où et quand : semaine type avec tous les lieux en couleur, créneaux en double signalés, « C’est ici » propose l’établissement où vous êtes', '2. Qui : nom en grand, spécialités en tuiles, potentiel en étoiles, Prescription engagée Oui / Non, bouton Appeler', 'Enregistrer toujours visible en haut ; Modifier (en haut et sur la carte) ouvre le même écran']],
    ['3.27.0', ['Position imprécise : le message n’apparaît plus lors des mesures automatiques (ouverture, synchronisation, toutes les quelques minutes), seulement quand vous demandez votre position, au plus une fois par heure ; la précision reste indiquée dans l’encadré']],
    ['3.26.99', ['Géolocalisation : une mesure moins précise ne remplace plus une mesure récente plus précise (sauf vrai déplacement)', 'Distances : si la position est à plus de ± 50 m, elles sont affichées « ≈ » et arrondies à 50 m']],
    ['3.26.98', ['Recherches : seule la précision de la position est indiquée (± X m) dans l’encadré ; l’alerte d’imprécision reste dans le message temporaire']],
    ['3.26.97', ['Géolocalisation : position remesurée à chaque synchronisation et ouverture, en attendant une précision de ± 20 m (jusqu’à 25 s) ; alerte si la position reste imprécise ; les distances sont recalculées dès la mesure obtenue']],
    ['3.26.96', ['Distances : point de départ et précision affichés (votre position ± X m, ou point choisi) ; position GPS remesurée à l’ouverture des recherches ; alerte si la position est imprécise']],
    ['3.26.95', ['Dans des hôpitaux : spécialités et moment rappelés en tête', 'Journée : cartes des visites avec compte rendu sur fond vert léger']],
    ['3.26.94', ['Planifier : un praticien retiré ou remplacé dans la liste proposée n’est plus jamais reproposé au recalcul tant que les critères ne changent pas']],
    ['3.26.93', ['En-tête MediPlanner (date, nom, synchro, roue crantée) visible sur toutes les fenêtres et sous-pages', 'Dans des hôpitaux / Pharmacies dans une zone : « Dans la tournée du jour » en évidence, collègue qui l’a prévu indiqué, engagés en couleur comme dans le Répertoire']],
    ['3.26.92', ['Pharmacies dans une zone et Dans des hôpitaux : communes ou hôpitaux retenus rappelés en tête et dans le filtre ; « Jamais visité » / « Vu il y a » en étiquette comme dans le Répertoire']],
    ['3.26.91', ['Dans des hôpitaux : repères en tête (médecins trouvés, déjà visités, jamais visités, le plus proche), une seule liste du plus proche au plus lointain, spécialité, hôpital et Tél dans la carte']],
    ['3.26.90', ['Pharmacies dans une zone : repères en tête (nombre trouvé, jamais visitées, la plus proche), une seule liste de la plus proche à la plus lointaine, quartier et Tél dans la carte']],
    ['3.26.89', ['Autour de moi : 4 choix (Par ma position, Selon mes filtres, Dans des hôpitaux, Pharmacies dans une zone) ; « Dans une zone » renommé « Pharmacies dans une zone »']],
    ['3.26.88', ['Compte rendu de visite : choix proposés par défaut (visite faite : Oui ; types et produits : les derniers choisis ; produits présentés : Oui ; réaction : la dernière, sinon Intéressé ; échantillons : Oui ; suite : Aucune) ; un toucher suffit pour confirmer']],
    ['3.26.87', ['+ Pharmacie : 3e choix « Dans une zone » : toutes les pharmacies ouvertes dans les communes ou secteurs choisis, ce jour-là, au moment choisi (journée, matin, soir ou maintenant), avec la distance']],
    ['3.26.86', ['Autour de moi : 3e choix « Dans des hôpitaux » : médecins présents dans un ou plusieurs hôpitaux, ce jour-là, à un moment donné (journée, matin, soir ou maintenant), filtrés par spécialité si besoin']],
    ['3.26.85', ['Données : une ancienne copie de la base restée sur le téléphone ne revient plus à l’ouverture (fin des noms corrigés qui réapparaissent puis sautent) ; la copie la plus récente est toujours retenue', 'Réglages › Avancé : « Recharger toute la base »']],
    ['3.26.84', ['Modifier : « 1. Lieux & planning » à gauche (ouvert d’abord), « 2. Médecin » à droite']],
    ['3.26.83', ['Synchroniser : un téléphone relié à un ancien déploiement du serveur bascule tout seul sur le serveur à jour (même classeur, même jeton) puis recharge les données']],
    ['3.26.82', ['Les visites à venir reprennent à chaque synchronisation les données actuelles de la base (spécialité, hôpital, quartier, GPS, horaires), sans recalculer la tournée']],
    ['3.26.81', ['Données venant d’un ancien serveur : rechargement complet automatique ; Réglages › Avancé signale un lien de connexion ancien et affiche la fin de l’adresse du serveur']],
    ['3.26.80', ['Ouverture : la base gardée sur le téléphone est relue avant toute synchronisation (plus de retéléchargement complet ni d’écran « Chargement » à chaque ouverture) ; stockage protégé contre l’effacement automatique']],
    ['3.26.79', ['Compte rendu, étape 4 : Losartan AM retiré partout (y compris sans connexion) ; cartes produit de même taille, sur 2 lignes si besoin']],
    ['3.26.78', ['Répertoire : « Ajouter au jour » demande confirmation avant d’ajouter']],
    ['3.26.77', ['Planifier, RDV et prioritaires : « Ajouter » en vert, même taille que « Retirer », en dernière ligne']],
    ['3.26.76', ['Journée, jour sans planification : « Reprendre un ancien programme » sous « Planifier le … »']],
    ['3.26.75', ['Répertoire : 8 px entre la grille, « Modifier le planning hebdomadaire » et les boutons du bas', 'Planifier, étape RDV et prioritaires : bouton « Retirer » sur chaque RDV et prioritaire, et appui long pour retirer, avec confirmation']],
    ['3.26.74', ['Répertoire : « Modifier le planning hebdomadaire » devient un bouton centré, à la hauteur de « Planifier » ; boutons du bas resserrés']],
    ['3.26.73', ['Téléphone relié mais base non reçue : écran « Chargement » avec Réessayer au lieu de l’écran d’accueil ; délai de 2 min au premier chargement', 'Un même lieu saisi sur plusieurs lignes n’apparaît qu’une fois (jours réunis), et l’enregistrement de la fiche nettoie la base', 'Notifications du téléphone (Réglages) : pharmacie ou médecin proche avec la distance, conflit avec un collègue']],
    ['3.26.72', ['Compte rendu : seuls les produits actifs de la base apparaissent (Losartan AM retiré) ; Gamme Aura 2, compteur et « Tous » sur une ligne ; produits d’une même famille sur une seule ligne']],
    ['3.26.71', ['Liste des quartiers : Cocody, Yopougon et Abobo regroupés sous leur commune ; les secteurs apparaissent en sous-titres une fois la commune dépliée']],
    ['3.26.70', ['Compte rendu WhatsApp aéré : titre « CR du Ven. 30/10/2026 », sans heures ni pastilles de position, une visite par bloc']],
    ['3.26.69', ['Planifier : « km estimés » ; Répertoire : Tél et Réception serrés, Réception sur une ligne ; GPS toujours en x/y (GPS 1/1) ; Ajouter au jour, Planifier, Modifier à la hauteur de « Réinitialiser les filtres »']],
    ['3.26.68', ['Abréviations : Dermato, Néphro, Ophtalmo, Rhumato, Gastro', 'Planifier : km du parcours du jour estimés d’une visite à la suivante', 'Répertoire, pharmacie : « Réception » avec le Tél dans le même encadré']],
    ['3.26.67', ['Planifier : date courte (Mar. 03 Nov.) ; ligne de détail centrée avec Cœur / Autres selon le cœur de cible']],
    ['3.26.66', ['Planifier : Ajouter, Recalculer, Accepter à la même hauteur que « Critères »']],
    ['3.26.65', ['Planifier : « Ajouter », « Recalculer » et « Accepter » (ou « WhatsApp ») sur une seule ligne', 'Journée : samedis, dimanches et jours fériés présents dans la frise, grisés']],
    ['3.26.64', ['En-tête MediPlanner (date, mode, roue crantée) fixé en haut au défilement', 'Journée : une visite supprimée par appui long ne revient plus', 'Modifier, écran 2 : GPS en icône à côté du nom de l’hôpital ; quartier et repères côte à côte ; toucher « Matin » ou « Soir » coche toute la colonne ; jours abrégés ; résumé des jours sur chaque lieu replié ; « Autre lieu » et « Absence » sur une ligne']],
    ['3.26.63', ['Filtre par commune plus strict : seule la commune du lieu compte (plus de lieu d’une autre commune retenu à cause d’un mot de son nom)', 'Praticien à plusieurs lieux : la commune filtrée apparaît en premier (en gras) et son lieu en tête de la grille']],
    ['3.26.62', ['Planifier : bouton « Modifier » (fiche du praticien) dans les options d’une visite de la liste', 'Journée : appui très long (1,5 s) sur n’importe quelle carte : suppression de la visite après confirmation (si un compte rendu existe : remettre « à faire » ou supprimer)']],
    ['3.26.61', ['Fiche médecin : retour à 2 étapes (1. Médecin, 2. Lieux & planning), champs resserrés pour le téléphone']],
    ['3.26.60', ['Fiche médecin sur une seule page : identité puis lieux (l’hôpital n’est saisi qu’une fois)', 'GPS du lieu : un bouton et une pastille, sans coordonnées', 'Planning : horaires dans l’en-tête des colonnes Matin / Soir ; pas de barre « Lieu 1 » quand il n’y a qu’un lieu ; ouverture directe sur la grille', 'Phrase « Établissement connu… » retirée', 'Reconnaissance des établissements plus stricte : un sigle court (ex. ICA) n’est plus trouvé à l’intérieur d’un autre mot (ex. médical)']],
    ['3.26.59', ['Planning hebdomadaire : « Oui » remis dans la grille', 'Fiche : plus de liste de quartiers en tapant l’hôpital ; quartier, GPS et repères repris automatiquement quand l’hôpital est connu']],
    ['3.26.58', ['Spécialités abrégées (MG, Cardio, Diabéto, Endocrino, Gynéco) dans Planifier, compte rendu, critères et fiche ; spécialité en gras dans Planifier', 'Fiche et planning hebdomadaire : lieux repliables comme dans Produits (sans « Déplier »), raccourcis Semaine / Matins / Soirs sur une ligne, grille plus compacte', 'Répertoire : pastille GPS avec les étiquettes (Engagé, Vu il y a…)']],
    ['3.26.57', ['Fiche médecin : pastille GPS et « Touchez M ou S » déplacées sous la dernière ligne M / S']],
    ['3.26.56', ['Distances : coefficient vol d’oiseau porté de 1,5 à 1,6', 'Fiche médecin : pastille GPS et « Touchez M ou S pour planifier » déplacées ensemble sous la dernière ligne M / S (place gagnée sous le nom du lieu)', 'Fiche : « Tél : » et dernier commentaire resserrés']],
    ['3.26.55', ['Feuille de style nettoyée : 128 forçages « !important » inutiles retirés, affichage strictement identique (vérifié sur 72 écrans, clair et sombre)']],
    ['3.26.54', ['Positions : une seule règle pour toute l’application (coordonnées avec virgule ou point, 0 ou hors Côte d’Ivoire = pas de GPS ; position du téléphone valable 10 min partout)', 'Boutons harmonisés : même forme arrondie, même hauteur et même taille de texte dans tous les onglets']],
    ['3.26.53', ['Base : le quartier est séparé des repères d’adresse (nouvelle colonne Repères), modifiables dans la fiche', 'Contrôle automatique des doublons de numéros de lieu et de codes']],
    ['3.26.52', ['Journée, appui très long sur une visite renseignée : remettre « à faire » ou supprimer complètement la visite']],
    ['3.26.51', ['Journée : appui très long (1,5 s) sur une visite renseignée = effacer son compte rendu, après confirmation',
      'Répertoire : pastilles M / S du planning séparées de « Touchez M ou S pour planifier » (plus de chevauchement)',
      'Jours grisés en vrai gris', 'Modifier : en tapant le nom de l\'hôpital, les quartiers correspondants s\'affichent à choisir']],
    ['3.26.50', ['Répertoire : pastille GPS = simple indicateur (vert : position en base, rouge : absente) ; bouton « Modifier »',
      'Journée s\'ouvre sur aujourd\'hui, au centre de la frise, grisé si non ouvré ; Planifier a aussi le petit calendrier',
      'Modifier : le choix Médecin / Pharmacie n\'apparaît plus en modification',
      'CR : Gamme A devient Gamme Aura 2, Gamme B devient Gamme Aura 1',
      'Lieux qui changeaient de nom à l\'écran : identifiants en double neutralisés ; correction d\'un planning = ligne écrasée, plus de ligne en trop',
      'Installation : instructions adaptées (WhatsApp, Samsung, iPhone), accès conservé après installation']],
    ['3.26.49', [
      'CR Pharmacie : Seuls les produits strictement sélectionnés à l\'étape 4 apparaissent à l\'étape 5 (suppression du pré-remplissage parasite)',
      'Remplacement Praticien : Libellés des actions raccourcis et clarifiés (« Changer » et « Remplacer ») avec hauteur harmonisée à 44 px',
      'Mode Sombre : Adaptation intégrale du bandeau de critères du Répertoire et du bouton « Réinitialiser les filtres » aux tons sombres'
    ]],
    ['3.26.48', [
      'CR Visite / Ergonomie pouce : Mémorisation précise du point de contact (hauteur du pouce) lors de l\'ouverture d\'une visite',
      'Défilement intelligent : Les options et boutons de validation s\'affichent directement à la hauteur du pouce sans effort',
      'Garde-fou contextuel : L\'intitulé de la question et le praticien restent 100 % visibles sous l\'en-tête (jamais masqués)',
      'Charte graphique : Harmonisation des teintes ambre et vert avec les jetons CSS dynamiques'
    ]],
    ['3.26.47', [
      'Répertoire : Rationalisation complète des espacements sous la grille des présences (suppression des vides cumulés)',
      'Planning hebdomadaire : Lien rattaché immédiatement au tableau comme commande contextuelle sans flotter dans le vide',
      'Actions terrain : Bouton GPS (44px) et rangée d\'actions (44px) harmonisés avec espacement strict et régulier de 6 px',
      'Clarté des actions : Bouton « Modifier fiche » explicite pour éviter toute confusion avec le planning hebdomadaire'
    ]],
    ['3.26.46', [
      'Planifier / Remplacement : Refonte visuelle complète de l\'écran de confirmation en cartes comparatives hiérarchisées (Visite initiale ➔ Nouveau rendez-vous)',
      'Remplacement : Établissement, adresse, quartier, créneau et heure de passage clairement valorisés sans pavé de texte compact entre parenthèses',
      'Ergonomie : Boutons d\'action directs « Choisir un autre » et « Valider le remplacement » (suppression des boutons ambigus Sortir et Non)',
      'Navigation : La touche retour (<) en tête d\'écran revient naturellement à la liste des remplaçants proposés sans fermer la feuille'
    ]],
    ['3.26.45', [
      'Planifier : Remplacement strict par type (médecins remplacés uniquement par médecins, pharmacies uniquement par pharmacies)',
      'Planifier : Actions directes « Garder » ou « Retirer » si aucun candidat remplaçant n\'est disponible',
      'Répertoire : Mention « Touchez M ou S pour planifier » affichée systématiquement à côté du bouton GPS sur chaque établissement'
    ]],
    ['3.26.44', [
      'Recherche : Bouton « Visité -30 j » en accès direct et dans le suivi pour filtrer tous les praticiens visités ces 30 derniers jours',
      'Secteurs & Quartiers : Préservation explicite de « Cocody Centre » (ne s\'affiche plus sous la dénomination isolée « Centre »)',
      'Établissements : « CSU Communautaire » abrégé en « CSU COM » (titres et fiches)',
      'Adresses & Voirie : « Boulevard » harmonisé en « Blvd. » (adresses, fiches et tournées)'
    ]],
    ['3.26.43', [
      'Établissements : Abréviations conventionnelles ciblées et professionnelles (CHU, CHR, HG, CSU, CMS, CM, GM, Poly., FSU COM, PISAM, SAMU, HMA, ICA)',
      'Établissements : Préservation intégrale des noms de quartiers et cliniques (ex. « Deux Plateaux », « Saint-Sauveur »)',
      'Répertoire : Titre d\'établissement en pleine largeur sans coupure ni points de suspension'
    ]],
    ['3.26.42', [
      'Répertoire : Noms complets des hôpitaux affichés sans abréviation et sur toute la largeur disponible',
      'Répertoire : Fin des noms tronqués avec suspension (...), espace à droite pleinement exploité au-dessus des jours',
      'Planning : Suppression définitive de la ligne grise/barre disgracieuse sous « Modifier le planning hebdomadaire »'
    ]],
    ['3.26.41', [
      'Planifier : Synthèse journalière sur 2 lignes strictes avec communes intégrées dès la 1re ligne (ex. « Lundi 2 nov. · 7 visites · Cocody, Abobo »)',
      'Fiche Praticien : Récupération automatique immédiate du quartier, de la commune et du GPS pour tout établissement déjà en base',
      'Répertoire / Fiche : Suppression de la bordure sous « Modifier le planning hebdomadaire » et cadre épuré',
      'Sélecteur de Quartiers : Grand Abidjan en tête, découpage par secteurs (Cocody, Yopougon, Abobo), quartiers alphabétiques et villes de l\'intérieur masquées en bas',
      'Écran d\'accueil : Le toucher sur l\'écran suspend le décompte automatique pour laisser le temps de lire, puis permet de valider son option'
    ]],
    ['3.26.40', [
      'CR Pharmacie : État « Disponible » (remplaçant « En stock »), options stocks en grille 2×2 compacte et texte d\'aide retiré',
      'Critères de recherche : Options de suivi (Étape 5) rationalisées en 2 lignes équilibrées',
      'Navigation des étapes : Hauteurs strictement harmonisées entre Suivant, Précédent et Passer partout',
      'Recherche & Planifier : Bouton « Liste complète… » des spécialités élargi et centré',
      'Répertoire : Bouton « Renseigner le planning » parfaitement centré'
    ]],
    ['3.26.39', [
      'Répertoire : Mention « Touchez M ou S pour planifier » strictement verrouillée sur une seule ligne avec l\'icône GPS'
    ]],
    ['3.26.38', [
      'CR Pharmacie : Interlocuteurs renommés (« Vendeurs » et « Chargé Commande »)',
      'CR Pharmacie : Activités raccourcies (« Retour » au lieu de « Retour ou échange »)',
      'CR Pharmacie : Sélection des produits en stock préalable par gammes compactes (miroir parcours médecin)',
      'CR Pharmacie : Détail des stocks affiché uniquement pour les produits sélectionnés (fin de la longue liste)',
      'CR Pharmacie : État « Non référencé » supprimé des choix de stock',
      'CR Pharmacie : Commande passée ne demande plus de quantités superflues',
      'CR Pharmacie : Étape 8 suite raccourcie en « Suivi » (au lieu de « Suivi de commande »)'
    ]],
    ['3.26.37', [
      'Planifier : Calendrier affiché sous le format « Mer. 16 Déc. » avec jour et mois abrégé',
      'Répertoire : Établissements affichés sur une seule ligne (abréviations cliniques et colonnes jours compactes)',
      'Répertoire : Mention « Touchez M ou S pour planifier » alignée sur la même ligne que l\'icône GPS',
      'Répertoire : Icône de géolocalisation GPS (épingle 📍) harmonisée sur les badges et boutons',
      'Répertoire : Bandeau critères harmonisé avec bouton « Réinitialiser les filtres » grisé par défaut quand inactif',
      'Répertoire (Planning / Adresse) : Nom d\'hôpital vide par défaut (placeholder d\'invitation) et liste ordonnée des hôpitaux proches',
      'CR Visite : Affichage immédiat des motifs d\'absence après avoir cliqué sur « Non » sans écran intermédiaire',
      'CR Visite : Proposition directe en 1 étape « Remplacer » ou « Non », et pas de remplaçant si « Non »',
      'CR Visite : Étape 2 raccourcie en « Présentation » et Étape 8 « Envoyer infos » / bouton « Terminer »',
      'CR Visite : Étape 4 produit sélectionné vert sans coche de validation superflue',
      'CR Visite : Barre de recherche interactive en tête de liste des remplaçants proposés'
    ]],
    ['3.26.36', [
      'Répertoire : Badge GPS compact avec icône cible et ratio (ex. 🎯 2/2), suppression de la coche et des mentions superflues'
    ]],
    ['3.26.35', [
      'Planifier : Espacement gauche resserré (gain de 12px), noms des praticiens repoussés vers la gauche',
      'Planifier : Distance en km affichée pour les pharmacies (comme pour les médecins)',
      'Planifier : Zone Intérieur repliée et masquée par défaut dans les communes visitées',
      'Critères de recherche : Hauteur strictement harmonisée à 38px pour tous les boutons',
      'Critères (Étape 5) : Libellés raccourcis « Visité -30j » et « En retard » (gain de hauteur)',
      'Répertoire : Mention explicite « toutes spécialités » lorsque tous les types de médecins sont sélectionnés',
      'Répertoire : Condensation homogène pour Abobo, Cocody et Yopougon'
    ]],
    ['3.26.34', [
      'Planifier : Caducée / symbole déplacé à gauche au-dessus de l\'heure, boutons « Gardé » et « ✕ » abaissés',
      'Planifier : Noms de médecins et pharmacies affichés en pleine largeur sur une seule ligne continue',
      'Répertoire : Mention explicite « Toute la base de données » lorsque aucun filtre n\'est actif',
      'Critères de recherche (Étape 4) : Affichage épuré des étoiles seules (★★★, ★★, ★) sans texte redondant'
    ]],
    ['3.26.33', [
      'Répertoire : Condensation automatique des communes entières (ex. « Cocody » au lieu des 4 sous-secteurs)',
      'Répertoire : Suppression du nom de commune redondant sur les secteurs ciblés (ex. « Deux Plateaux, Riviera »)',
      'Répertoire : Masquage des spécialités si tous les types de médecins sont sélectionnés pour un bandeau compact',
      'CR Étape 5 (Réaction) : « Non intéressé » et « Non évalué » alignés côte à côte sur la même ligne (gain de hauteur)',
      'Suivi & Contrôle : Vérification et complétion des coordonnées GPS des pharmacies en base Google Sheets'
    ]],
    ['3.26.32', [
      'Suppression de date planifiée : Bouton de confirmation harmonisé avec la charte graphique sarcelle (aucun rouge)',
      'Respect strict de la charte visuelle médicale sur l\'ensemble des modales et animations'
    ]],
    ['3.26.31', [
      'Onglet Planifier : Suppression d\'une date planifiée par appui long (~650 ms) sur n\'importe quelle date de la frise ou sur le titre de la journée',
      'Retour haptique : Vibration au déclenchement de l\'appui long sur smartphone compatible',
      'Confirmation sécurisée : Boîte de dialogue de confirmation avec protection anti-fermeture accidentelle (retrait définitif du bouton corbeille)',
      'Communes visitées : Compteur, chevron et sélection « Jour / Sem. » alignés sur une seule ligne compacte'
    ]],
    ['3.26.30', [
      'Onglet Planifier : « Communes visitées », compteur et « Jour / Sem. » alignés sur une seule ligne compacte',
      'Onglet Planifier : Déblocage garanti de tous les clics après suppression ou appui long'
    ]],
    ['3.26.29', [
      'Onglet Planifier : Suppression de journée fiabilisée par appui très long tactile & bouton corbeille dédié',
      'Onglet Planifier : « Communes visitées » affiché en entier sans troncature sur tous les écrans'
    ]],
    ['3.26.28', [
      'Onglet Planifier : « Communes visitées » affiché en entier sans troncature sur tous les écrans',
      'Onglet Planifier : Appui très long sur une date planifiée pour la supprimer avec message de confirmation'
    ]],
    ['3.26.27', [
      'Répertoire : phrase d\'introduction « Tous vos contacts »'
    ]],
    ['3.26.26', [
      'Phrases d\'introduction des onglets raccourcies et reformulées'
    ]],
    ['3.26.25', [
      'Indicateur GPS simplifié : icône GPS + « GPS » (sans coche ni « fixé »)'
    ]],
    ['3.26.24', [
      'En-tête : Rétablissement du bouton de synchronisation avec son libellé textuel complet (« À jour », « Synchro… », « Hors ligne ») et retrait du Copilote IA',
      'Répertoire : Résumé des critères condensé sur 1 à 2 lignes avec abréviations médicales usuelles (cardio, diabéto, gynéco, pédia, dermato, etc.)',
      'Répertoire : Bandeau et bouton « Réinitialiser les filtres » harmonisés avec la charte graphique médicale sarcelle / turquoise (suppression du rouge contrastant)'
    ]],
    ['3.26.23', [
      'Ergonomie de repérage : Phrases d\'introduction calibrées sur chaque onglet (claires, descriptives et tenant sur 2 lignes maximum)',
      'Journée : « Déroulez votre tournée dans l\'ordre : itinéraire GPS, contacts praticiens et comptes rendus. »',
      'Planifier : « Préparez votre tournée selon vos priorités : ajustez vos critères par secteur et validez votre planning. »',
      'Répertoire : « Tous vos contacts : recherchez, filtrez, mettez à jour leurs fiches et leurs lieux de visite. »',
      'Produits : « Votre aide-mémoire de visite : produits, arguments clés et échantillons. »',
      'Suivi & Contrôle : « Pilotez votre activité : réalisations, tournées de l\'équipe et qualité des données. »'
    ]],
    ['3.26.22', [
      'Ergonomie des onglets : Courte phrase d\'introduction pour chaque onglet afin de se situer immédiatement sans gaspiller d\'espace',
      'Onglet Planifier : Phrase courte (« Ajustez vos critères et confirmez votre tournée. »)',
      'Onglet Suivi & Contrôle : Phrase d\'introduction ajoutée (« Indicateurs de tournée, activité de l\'équipe et audit qualité. »)',
      'Onglet Répertoire : Phrase d\'introduction concise et bandeau de critères optimisé avec bouton « Réinitialiser » rouge centré'
    ]],
    ['3.26.21', [
      'Onglet Planifier : Noms des médecins garantis intégraux sans coupure ni suspension',
      'Onglet Planifier : Suppression de la phrase d\'introduction pour libérer l\'espace écran',
      'En-tête : Bouton synchro ultra-compact (point vert/rouge + rafraîchissement seul) libérant toute la place pour le nom du délégué',
      'Bouton IA & Réglages : Format compact circulaire harmonisé 34px',
      'Copilote IA ✨ : Possibilité de poser des questions libres avec réponses intelligentes instantanées'
    ]],
    ['3.26.20', [
      'Onglet Planifier : Noms des médecins jamais tronqués (configuration d\'origine rétablie)',
      'Onglet Planifier : Synthèse structurée exactement sur 2 lignes (Ligne 1: Date & visites, Ligne 2: Détails)',
      'Calendrier : Zéro défilement tactile ni bavure d\'ombre, affichage 100% net',
      'Copilote IA ✨ : Bouton d\'aide interactif discret dans l\'en-tête'
    ]],
    ['3.26.19', [
      'Sécurité GPS multi-sites : Capter la position GPS sur un médecin multi-établissements ouvre un sélecteur tactile du lieu précis où vous êtes sur place (aucun risque d\'écraser Cocody en étant à Yopougon !)',
      'Tableau des présences : Bouton micro-GPS direct sous chaque établissement pour actualiser son GPS individuel en un toucher sans passer par Modifier',
      'Répertoire : Bandeau élégant associant la phrase explicative des critères et un joli bouton tactile « Réinitialiser » côte à côte'
    ]],
    ['3.26.18', [
      'Médecins engagés exclusivement : Nom affiché en couleur Ambre Chaud / Or Prescripteur (#B45309), tous les autres praticiens strictement en noir comme avant, petites étiquettes inchangées'
    ]],
    ['3.26.17', [
      'Onglet Journée : Calendrier mensuel repensé plus moderne et aéré (grandes cellules 44px au pouce, badge d\'année, chips d\'accès rapide, indicateur d\'activité)',
      'Médecins engagés : Nom affiché en couleur Ambre Chaud / Or Prescripteur (#B45309) dans toute l\'application'
    ]],
    ['3.26.16', [
      'Fiches produits (BDD & App) : Ajout de la colonne A « Actif » avec cases à cocher dans Google Sheets ; tout médicament décoché est automatiquement masqué dans toute l\'application'
    ]],
    ['3.26.15', [
      'Répertoire : Code couleur strict et intuitif des créneaux de réception (Matin = Vert / Émeraude, Soir = Bleu)'
    ]],
    ['3.26.14', [
      'Onglet Journée : Restauration de l\'icône calendrier d\'origine et nouveau calendrier mensuel compact, ergonomique au pouce et 100% stable sans saut de hauteur',
      'Onglet Planifier : Rationalisation du bloc « Communes visitées » (suppression des répétitions X/Y et du bouton doublon)',
      'Planifier (Étape 5 - Potentiel) : Affichage épuré avec uniquement les étoiles (★★★, ★★, ★) sans mentions textuelles (fort, moyen, faible)'
    ]],
    ['3.26.13', [
      'Onglet Planifier : Le bouton et le critère rapide affichent strictement « Demain » (sans mention jj/mm)'
    ]],
    ['3.26.12', [
      'Onglet Planifier : Bouton « Réglages » renommé en « Critères » pour plus de clarté',
      'Suivi & Contrôle : Le mois s\'affiche désormais avec le maximum de lettres sans troncature à côté de « Toute l\'équipe », avec abréviation élégante automatique sur petit écran (ex: Déc. 2026)'
    ]],
    ['3.26.11', [
      'Ergonomie pouce & centrage tactile du Compte Rendu : ajustement et défilement automatique sous le pouce dès l\'ouverture et entre les étapes',
      'Option « Sortir » immédiatement accessible sous le pouce dès le compte rendu validé',
      'Compte Rendu : Km parcourus calculés automatiquement sur toutes les visites du jour (y compris absent / non vu), suppression du champ manuel',
      'CR médecin : Étape 4 épurée (suppression des mentions superflues), grille des réactions et suites 2 par ligne, badge médicament mis en valeur au 1er regard',
      'Besoins du jour : Rationalisation en grille à 2 colonnes ergonomique',
      'Communes visitées : Affichage compact et groupé sur la même ligne dans la synthèse',
      'Onglet Journée : Calendrier moderne optimisé au pouce avec grille mensuelle, pastilles visites et raccourcis',
      'Onglet Journée : Simplification de « Non, je le garde » en « Non » en cas de visite déjà prévue par un collègue',
      'Onglet Planifier : Décompte explicite du nombre de pharmacies et de médecins avec le matin/soir',
      'Suivi Équipe : Sélecteur délégué et semaine verrouillés sur la même ligne'
    ]],
    ['3.26.10', [
      'Onglet Journée : Harmonisation géométrique de la frise temporelle, des heures et des cartes de visite sans aucun chevauchement, tout en conservant une largeur maximale de carte'
    ]],
    ['3.26.9', [
      'Remplacement sur place & multi-sites : Si le praticien X est absent au CHU, le confrère Y qui y exerce aussi est proposé et ajouté d\'office sur le CHU (priorité au même établissement)',
      'Répertoire épuré : Boutons « Capter position GPS » et « Ajouter au jour » au design compact et clair',
      'Grille de présences : Lien « Modifier le planning hebdomadaire » parfaitement centré sous le tableau',
      'Compte Rendu de visite optimisé : Suppression de la molécule sous le médicament (Losartan sous Zyltan, etc.), espacements resserrés et carte élargie sur la gauche'
    ]],
    ['3.26.8', [
      'Répertoire : Bouton « Capter ma position GPS ici » grand format (48px) avec statut tactile direct',
      'Tournée terrain : Raccourci « Ajouter au jour » pour forcer instantanément une visite du jour',
      'Audit Qualité BDD : Distinction intelligente des équipes hospitalières des vrais centroïdes suspects'
    ]],
    ['3.26.7', [
      'Garantie d\'affichage des secteurs dans Planifier > Communes ciblées : injection systématique des 4 sous-secteurs pour Cocody, Yopougon et Abobo même si la base locale contenait d\'anciens enregistrements non segmentés',
      'Compatibilité immédiate sans nécessiter de réinitialisation préalable'
    ]],
    ['3.26.6', [
      'Nomenclature stricte des 3 grandes communes : Cocody (Angré, Deux Plateaux, Riviera, Centre), Yopougon (Niangon, Maroc & Toits Rouges, Centre & Mairie, Sud & Gesco), Abobo (Nord & PK18, Centre & Mairie, Baoulé & Avocatier, Sud & Plaque)',
      'Ordre d\'affichage et repères harmonisés dans toute l\'application et la base'
    ]],
    ['3.26.5', [
      'Suppression des doublons dans Suivi & Équipe : retrait de la rangée de boutons délégués en haut qui dupliquait la liste du bas',
      'Gain d\'espace mobile : suppression des sous-titres verbeux et phrases longues pour un affichage direct et épuré',
      'Navigation directe & intuitive : sélection d\'un délégué depuis sa carte de synthèse avec retour en 1 touche',
      'Communes & Secteurs : sélection globale « Toute la commune » ou choix individuel de 1, 2, 3 secteurs sans friction'
    ]],
    ['3.26.4', [
      'Cartes CR visites compactes & sobres : suppression des textes à rallonge sur les boutons et allègement vertical',
      'Boutons d\'action épurés : « Enregistrer » et « Remplacer » sans phrases encombrantes',
      'Parcours de visite fluide : retour aux étapes progressives compactes sans blocs massifs'
    ]],
    ['3.26.3', [
      'Planifier - Refonte des secteurs : segmentation stricte réservée aux 3 grandes communes (Abobo, Cocody, Yopougon - 4 sous-secteurs chacune)',
      'Communes d\'Abidjan épurées : toutes les autres communes (Port-Bouët, Marcory, Plateau, etc.) redeviennent des puces simples et compactes sans pollution visuelle',
      'Cartes ergonomiques au pouce : bannières élégantes \'Toute la commune\' avec grilles 2 colonnes de sous-secteurs et repères clairs'
    ]],
    ['3.26.2', [
      'Boutons produits compacts & élégants : hauteur physique réduite à 34 px avec hitbox tactile invisible de 44 px au pouce',
      'Harmonie visuelle conservée : aucune déformation des cartes ni encombrement d\'écran'
    ]],
    ['3.26.1', [
      'Hot reload Service Worker : activation instantanée sans attente et rafraîchissement automatique des écrans mobiles',
      'Purge cache d\'urgence : le bouton « Recharger l\'application » désenregistre le worker obsolète et force la dernière version du serveur',
      'Garde-fou anti-téléportation GPS : alerte bloquante si l\'écart entre le smartphone et l\'établissement dépasse 3 km'
    ]],
    ['3.26.0', [
      'Stockage flash IndexedDB / SQLite : suppression du plafond de 5 Mo du localStorage, conservation intégrale de 10 000 praticiens et de l\'historique',
      'Rendu localisé & préservation du clavier : le clavier mobile ne saute plus lors de la frappe ou de l\'application des filtres',
      'Intents Android directs (WhatsApp / Téléphone) : ouverture instantanée en 1 touche sans page blanche intermédiaire',
      'Background Sync en zone blanche : synchronisation automatique des comptes rendus en tâche de fond dès le retour du réseau',
      'Accessibilité & Ergonomie WCAG 2.1 AA : cibles tactiles élargies à 44-48 px et annonceur vocal d\'écran'
    ]],
    ['3.25.49', [
      'Bande des produits fluide au pouce : suppression totale du défilement abusif et des sauts lors du choix d\'un médicament',
      'Découpage BDD des 3 grandes communes : Abobo, Cocody et Yopougon sectorisés directement dans la feuille Quartiers de la base de données',
      'Réactivité intégrale BDD : toute modification dans le Google Sheet (renommage de secteur, ajout de quartier) pilote immédiatement l\'application',
      'Mise à jour en 1 clic : nouveau bouton dans le menu MediPlanner du classeur pour installer les 4 secteurs détaillés'
    ]],
    ['3.25.48', [
      'Visite non réalisée / Absent fluide : options de motif directes sous le pouce, écran toujours parfaitement centré sans saut ni défilement bizarre',
      'Action immédiate sur absence : proposition instantanée de Remplacer sur place (+50 pts) ou d\'enregistrer l\'absence en 1 touche',
      'Secteurs Abobo affinés : intégration explicite de Derrière rails, Sagbé, Samaké, Abobo-Té et Dépôt SOTRA'
    ]],
    ['3.25.46', [
      'Secteurs détaillés par commune : découpage de Cocody, Yopougon et Abobo en 4 sous-secteurs pour planifier uniquement sur votre zone',
      'Sélection flexible : choix de toute la commune ou d\'un secteur précis (Angré, Riviera, Niangon, PK18, etc.)',
      'Filtrage automatique : affectation instantanée des praticiens selon leur quartier et établissement sans ressaisie'
    ]],
    ['3.25.45', [
      'Arguments clés de vente : ajout en 1er point du Prix indicatif (FCFA) et de la prise en charge CNAM / MUGEF-CI',
      'Planifier fluide au pouce : barre d\'actions flottante (Accepter, Recalculer, Ajouter) toujours accessible sans faire défiler',
      'Planifier sans éjection : toucher une visite ouvre ses actions (Changer de jour, Remplacer, Retirer) sans quitter la planification',
      'Suivi d\'équipe intuitif : accès direct à « Toute l\'équipe » d\'une touche sans masquer la liste des collègues',
      'KPI ★★★ territorialisé : ratio de praticiens prioritaires calculé sur votre secteur réel au lieu du pays entier'
    ]],
    ['3.25.44', [
      'Remplacement immédiat sur place : proposition instantanée des confrères du même établissement dès qu\'un médecin est absent (+ bonus de proximité)',
      'Clôture de journée anticipée : finalisation du compte rendu possible dès que toutes les visites sont faites (avec rappel le soir à 18 h 30)',
      'Fiche médecin sans doublon : passage direct au planning hebdomadaire sans ressaisir l\'établissement principal',
      'Rapport WhatsApp structuré : regroupement élégant des visites par établissement dans le compte rendu du soir'
    ]],
    ['3.25.43', [
      'Zones tactiles invisibles : extension des zones de frappe au toucher (>= 44 px) sans altérer le design sobre et élégant',
      'Mode Express dans les réglages : activation optionnelle d\'un formulaire CR en 1 seul écran synthétique pour les visites de routine'
    ]],
    ['3.25.42', [
      'Ergonomie pouce & navigation : passage à 5 onglets clés (fusion Équipe & Bilan en onglet « Suivi ») pour des cibles plus larges et confortables',
      'Anti-perte de saisie : confirmation de sécurité avant de quitter une fiche praticien en cours de modification',
      'Gestuelle mobile : glisser vers le bas (swipe-down) sur la poignée de la fenêtre pour la fermer au pouce',
      'Navigation Android : intégration du bouton retour physique/geste système pour refermer les fenêtres sans quitter la PWA',
      'Zéro impasse : bouton direct « Réinitialiser » dans les états vides de recherche et échappatoire rapide sur les produits du CR',
      'Synchronisation résiliente : déconnexion de l\'envoi des fiches et des CR pour éviter tout blocage hors ligne'
    ]],
    ['3.25.41', [
      'Produits dans le CR Visite : alignement strict sur la BDD (onglet Listes, colonne K) — tout retrait dans Listes!K retire le produit du CR sans toucher à sa fiche',
      'Auto-complétion des fiches produits : l\'ajout d\'un produit dans Listes!K déduit ses informations manquantes et l\'ajoute aux fiches consultables',
      'Onglet Produits : garantie que tous les produits actifs de la liste sont consultables avec leur monographie complète'
    ]],
    ['3.25.40', [
      'Répertoire des Hôpitaux dans la BDD : création de l\'onglet dédié « Etablissements » avec 260 centres de santé (CHU, CHR, Hôpitaux, FSU COM, Cliniques...) et GPS certifiés',
      'Distances réelles : application d\'un coefficient fixe x 1,5 sur toutes les distances pour refléter la réalité du terrain routier',
      'Notification de pharmacie proche : déplaçable au pouce en direct d\'un simple glissement si elle masque une zone de lecture ou de saisie',
      'Ajout & Modification médecin : accordéon exclusif sur les jours & horaires (seul un lieu est déplié à la fois, les autres restent pliés)'
    ]],
    ['3.25.39', [
      'Onglet Produits : rétablissement strict et fidèle de la disposition d\'origine (nom à gauche, molécules et pastilles compactes à droite)',
      'CR visite (Étape 4) : styles parfaitement isolés pour préserver l\'intégrité totale du catalogue produits'
    ]],
    ['3.25.38', [
      'CR visite (Étape 4) : nom du médicament en haut et dérivés en bas pleine largeur (suppression totale des chevauchements et espace décuplé pour les pastilles)',
      'CR visite (Étape 4) : cartes et pastilles produits ultra-larges et parfaitement lisibles sans coupure de texte'
    ]],
    ['3.25.37', [
      'CR visite (Étape 4) : pastilles produits élargies x3 horizontalement pour un confort tactile et visuel optimal sans coupure de texte',
      'CR visite (Étape 4) : Gamme B repliée par défaut sur une seule ligne compacte pour un gain d\'espace maximal',
      'Onglet Journée : spécialité médicale affichée en premier avant l\'hôpital dans les cartes praticiens',
      'Nettoyage typographique : élimination systématique des espaces multiples résiduels dans l\'interface',
      'Géolocalisation : intégration de la table de référence des 33 principaux hôpitaux et cliniques de Côte d\'Ivoire avec coordonnées GPS certifiées'
    ]],
    ['3.25.36', [
      'Répertoire : barre d\'actions sur une même ligne [ Recherche ] [ + Ajouter ] [ Modifier ] pour une ergonomie optimale',
      'Modification Praticien / Pharmacie : modification fluide et sans blocage des horaires d\'officine et du planning hebdomadaire avec normalisation tolérante',
      'CR visite (Étape 4) : déclinaisons par produit disposées 2 par 2 sur la même ligne selon la taille des noms pour un affichage parfaitement harmonieux',
      'Onglet Journée : affichage combiné de la distance, du temps de marche (piéton) et du temps en voiture recalculés dynamiquement',
      'Résolution des secteurs : rattachement automatique et propre des sous-quartiers réels (Angré, Wassakara, M\'badon, Attoban, Azito, Arras, etc.)'
    ]],
    ['3.25.35', [
      'Planifier : liste des médecins épurée avec Titre, Nom, Spécialité, Hôpital où on le voit ce jour (abrégé si long) et Secteur de l\'hôpital, sans coordonnées GPS (réservées aux pharmacies)',
      'Filtres de l\'application : harmonisation totale de toutes les communes et spécialités autour du filtre maître de l\'onglet Répertoire / Recherche',
      'CR visite (Étape 4) : disposition exacte des produits en lignes par molécule à gauche et pastilles de sélection à droite (conforme à la capture)',
      'Feuille Presences : vérification du ciblage automatique sur les colonnes uniques Latitude / Longitude'
    ]],
    ['3.25.34', [
      'Répertoire : le clic sur un praticien scrolle fluidement pour centrer la fiche au milieu de l\'écran',
      'CR visite (Étape 4) : accordéon Gamme A / Gamme B (une seule ouverte à la fois) et familles présentées par 2 par ligne avec pastilles de sélection compactes',
      'Nouveau médecin : vérification et normalisation automatique du nom des hôpitaux vers l\'orthographe officielle (zéro faute et zéro doublon en BDD)'
    ]],
    ['3.25.33', [
      'CR visite médecin (Étape 4) : produits présentés en lignes épurées par gamme/molécule avec pastilles de sélection et filtre rapide (Gamme A / Gamme B / Tous)',
      'Planifier : boutons « Ajouter » et « Recalculer » côte à côte sur la même ligne, et bouton « Accepter » centré en dessous',
      'Répertoire : recherche prioritaire par nom de praticien (les requêtes courtes n\'affichent plus de faux positifs de commune)',
      'Nouveau médecin : liste des hôpitaux propres excluant formellement les pharmacies, triée par proximité GPS',
      'Nouveau médecin : spécialité par défaut nettoyée et ordonnée en 3 sections claires (Cœur de cible, Spécialités médicales, Chirurgie & Autres)',
      'Jours de réception : raccourcis réorganisés (« Toute la semaine » en haut, « Tous les matins » et « Tous les soirs » centrés côte à côte en bas)'
    ]],
    ['3.25.32', ['Nouveau médecin : liste des hôpitaux suggérés triée par proximité réelle (position GPS et quartier) avec affichage de la distance']],
    ['3.25.31', ['Communes : zones géographiques repliables en accordéon compact avec badges de sélection et dépliage automatique à la recherche']],
    ['3.25.30', ['Planifier : critères verrouillés strictement sur 2 lignes fixes en grille responsive']],
    ['3.25.29', ['Nouveau contact (Médecin) : sélection d\'un établissement connu avec auto-complétion instantanée du quartier, de la commune et du GPS',
      'Nouveau contact (Pharmacie) : saisie fluide (nom en 1er, localisation GPS / quartier déduite)',
      'Jours & Heures de réception délégués : tous cochés par défaut pour permettre l\'enregistrement direct']],
    ['3.25.28', ['Planifier : critères d\'en-tête organisés sur 2 lignes fixes (gain d\'espace vertical garanti)',
      'Répertoire : bouton +Ajouter descendu au même niveau que « Rechercher par critères », largeurs et hauteurs harmonisées',
      'Programme WhatsApp : retrait des heures de chaque RDV dans le texte partagé',
      'Position & Distances : rafraîchissement automatique toutes les 5 minutes, à la réouverture et au rafraîchissement',
      'Précision GPS : détection « Sur place » immédiate sous 35 m et amélioration de la localisation devant les pharmacies']],
    ['3.25.27', ['Planifier : résumé des critères condensé sur 2 lignes (Communes, Praticiens, Spécialités / Potentiel, Rythme, RDV) pour libérer l\'espace',
      'Planifier (Spécialités) : étape 4 allégée (seul le cœur de cible s\'affiche) ; dans « Liste complète », barre de recherche élargie et autres spécialités repliées par défaut',
      'Compte rendu : parcours différencié Médecin (Types de visite médicale) vs Pharmacie (Activités en pharmacie) sans mention croisée',
      'Compte rendu : produits et médicaments présentés en grille symétrique à 2 par ligne, claire et aérée',
      'Compte rendu : prochaine étape enrichie avec l\'option « +1 j » (Demain) aux côtés de +7 j, +14 j et +30 j']],
    ['3.25.26', ['Correction : réactivité et affichage de l\'onglet Recherche / Répertoire',
      'Résilience au rafraîchissement : protection contre les écrans blancs avec récupération automatique',
      'Comparaison robuste du cœur de cible dans les filtres de recherche']],
    ['3.25.25', ['Compte rendu de visite : « Type(s) de visite » unifié et organisé (choix communs + spécifiques Médecin ou Pharmacie), avec présélection automatique des choix précédents',
      'Compte rendu de visite : Gamme A et Gamme B en accordéon (une seule ouverte à la fois) et produits regroupés par famille (Zyltan, Lesstrol, Telmikaa, Rozukaa…)',
      'Compte rendu de visite : « Étape suivante » (étape 9) positionnée sur « Aucune » par défaut',
      'Journée : « Finaliser le compte rendu » n\'apparaît qu\'en fin de journée (à partir de 18 h 30) et disparaît dès que le compte rendu est validé',
      'Répertoire (Ajouter / Modifier) : parcours différencié Pharmacie (position GPS fixe en haut, 1 écran) vs Médecin (établissements et hôpitaux multiples avec auto-complétion)',
      'Planifier amélioré : barre de critères rapide, raccourcis de période en 1 touche, compteurs corrigés et hauteur uniforme des champs voisins']],
    ['3.25.24', ['Compte rendu de visite : produits présentés rangés en Gamme A (Zyltan, Lesstrol, Eurythmic, Tensicard) et Gamme B, avec présélection automatique des derniers produits choisis',
      'Compte rendu de visite : « Étape suivante » sans saisie par défaut',
      'Planifier : option « Ajouter à aujourd\'hui (visite inopinée) » pour forcer un RDV ou médecin prioritaire en dépit du programme',
      'Planifier › Rythme de visite : compteurs centrés et alignés (« Visites par jour » et « Ne pas revoir avant »)',
      'Bouton « Tous » sur toutes les questions à choix multiples, phrases d\'introduction sur Planifier, Équipe, Bilan et Rattraper, et animations fluides des bandeaux de dates']],
    ['3.25.23', ['Planifier : défilement automatique vers « Nouvelle sélection » après un recalcul et boutons raccourcis',
      'Répertoire (Ajouter / Modifier) : prise de position GPS dès la 1re étape avec enregistrement immédiat possible, parcours adapté Médecin / Pharmacie et détection anti-doublons en direct']],
    ['3.25.22', ['Planifier : parcours de confirmation et d\'envoi WhatsApp épuré étape par étape (choix Ce jour / Tous les jours, question Oui/Non avant l\'aperçu WhatsApp, retour à la liste précédente après un recalcul)']],
    ['3.25.21', ['Planifier : bouton « Accepter » sous Ajouter manuellement et Recalculer automatiquement', 'Répertoire : nouvelle phrase d\'introduction', 'Autour de moi : critères et filtres uniformisés avec l\'onglet Répertoire']],
    ['3.25.18', ['Onglet Contacts renommé Répertoire']],
    ['3.25.16', ['+ Médecin / + Pharmacie : « Selon mes filtres » reprend toujours les filtres de l\'onglet Rechercher, communes comprises']],
    ['3.25.15', ['Autour de moi à 0,5 km : seulement les présents maintenant',
      'Compte rendu : après chaque réponse, la question suivante reste au milieu de l\'écran',
      'Compte rendu de pharmacie : chaque produit dans sa propre carte',
      'Journée : visites faites dans l\'ordre des heures d\'enregistrement, visites à faire du plus proche au plus loin',
      'Journée, + Médecin et + Pharmacie : les filtres par défaut sont toujours ceux de l\'onglet Recherche']],
    ['3.25.14', ['Position : la dernière connue est gardée en mémoire, les résultats s\'affichent tout de suite ; elle est recalculée en arrière-plan au rafraîchissement, à la réouverture et toutes les 2 minutes',
      'Autour de moi : 0,5 km par défaut',
      'Pharmacie ouverte à moins de 500 m : signalée à chaque rafraîchissement ou recalcul de position, sur tous les onglets']],
    ['3.25.13', ['Choisir un quartier : rangé par commune, une seule commune ouverte à la fois (la dernière ouverte), les autres repliées']],
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

  // ------------------------------------------------------------------ Accessibilité universelle WCAG 2.1 AA
  function annoncer(texte) {
    if (!texte) return;
    var el = document.getElementById('annonceur');
    if (!el) {
      el = document.createElement('div');
      el.id = 'annonceur';
      el.className = 'visuellement-cache';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = '';
    setTimeout(function () { el.textContent = texte; }, 50);
  }
