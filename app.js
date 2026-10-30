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

  var APP_VERSION = '3.26.46';
  // Nouveautés par version : l'écran d'accueil affiche, une seule fois, celles des versions
  // publiées depuis la dernière ouverture du téléphone
  var JOURNAL = [
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
  // ------------------------------------------------------------------ Stockage flash résilient (IndexedDB & SQLite)
  // Remplace le plafond des 5 Mo du localStorage par la mémoire flash illimitée du smartphone (WCAG & architecture offline).
  var IDB = {
    nom: 'mediplanner_db',
    version: 1,
    db: null,
    ouvert: false,
    init: function () {
      if (!window.indexedDB) return Promise.resolve(null);
      return new Promise(function (resolve) {
        try {
          var req = window.indexedDB.open(IDB.nom, IDB.version);
          req.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('donnees')) {
              db.createObjectStore('donnees', { keyPath: 'cle' });
            }
          };
          req.onsuccess = function (e) {
            IDB.db = e.target.result;
            IDB.ouvert = true;
            IDB.migrerDepuisLocalStorage();
            resolve(IDB.db);
          };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    },
    set: function (k, val) {
      if (!IDB.db) return;
      try {
        var tx = IDB.db.transaction(['donnees'], 'readwrite');
        tx.objectStore('donnees').put({ cle: k, val: val, maj: Date.now() });
      } catch (e) {}
    },
    get: function (k) {
      if (!IDB.db) return Promise.resolve(null);
      return new Promise(function (resolve) {
        try {
          var tx = IDB.db.transaction(['donnees'], 'readonly');
          var req = tx.objectStore('donnees').get(k);
          req.onsuccess = function (e) { resolve(e.target.result ? e.target.result.val : null); };
          req.onerror = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
    },
    vider: function () {
      if (!IDB.db) return;
      try {
        var tx = IDB.db.transaction(['donnees'], 'readwrite');
        tx.objectStore('donnees').clear();
      } catch (e) {}
    },
    migrerDepuisLocalStorage: function () {
      try {
        var clesLourdes = ['data', 'plan', 'hist', 'queue', 'fiches', 'archives', 'horsPlan'];
        clesLourdes.forEach(function (k) {
          var brut = localStorage.getItem(PREFIXE + k);
          if (brut) {
            try {
              var val = JSON.parse(brut);
              IDB.set(k, val);
              LS._mem[k] = val;
            } catch (e) {}
          }
        });
      } catch (e) {}
    }
  };

  var PREFIXE = 'tournees.';
  var LS = {
    _mem: {},
    get: function (k, d) {
      if (LS._mem[k] !== undefined) return LS._mem[k];
      try {
        var v = localStorage.getItem(PREFIXE + k);
        if (v !== null) {
          var obj = JSON.parse(v);
          LS._mem[k] = obj;
          return obj;
        }
        return d;
      } catch (e) {
        return d;
      }
    },
    set: function (k, v) {
      LS._mem[k] = v;
      IDB.set(k, v);
      if (k === 'plan' && typeof S !== 'undefined' && S && S.horsPlan) {
        IDB.set('horsPlan', S.horsPlan);
        try { localStorage.setItem(PREFIXE + 'horsPlan', JSON.stringify(S.horsPlan)); } catch (e) {}
      }
      try {
        var str = JSON.stringify(v);
        if (str.length < 500000) {
          localStorage.setItem(PREFIXE + k, str);
        }
      } catch (e) {}
    },
    vider: function () {
      LS._mem = {};
      IDB.vider();
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
        var t = LS.get('onglet', 'jour'), anciens = { tournee: 'jour', contacts: 'praticiens', recherche: 'praticiens', stats: 'bilan', historique: 'bilan' };
        t = anciens[t] || t;
        return ['jour', 'semaine', 'autour', 'rapport', 'praticiens', 'produits', 'bilan', 'equipe', 'reglages'].indexOf(t) >= 0 ? t : 'jour';
      })(), jour: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.j : null; })(),
      jourVue: (function () { var j = LS.get('jourVu', null); return j && j.le === aujourdhui() ? j.v || null : null; })(), ouvert: null, voirParams: false, feuille: null,
      recherche: '', filtre: 'tous', contactOuvert: null, limite: 40,
      sync: 'idle', erreur: '', installEvt: null, enCours: false,
      collegue: null, eqSel: LS.get('eqSel', []), jourEquipe: null, histFiltre: LS.get('histFiltre', 'moi'), rechercheAutour: '',
      couvPortee: LS.get('couvPortee', 'jour'), couvFiltre: LS.get('couvFiltre', 'couvertes'), couvOuverte: false, couvInterieurOuverte: false,
      statsVue: 'tableau', annulReprise: LS.get('annulReprise', null), eqPortee: LS.get('eqPortee', 'semaine'), eqDate: aujourdhui(),
      autour: LS.get('autour', { lat: null, lon: null, label: '', moment: 'maintenant', date: '', heure: '', rayon: 0.5, ref: null }),
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
  // 3.25.25 : cœur de cible dynamique (spécialités pré-sélectionnées par défaut, modifiables en 1 geste ; changer les spécialités met à jour le cœur de cible)
  var SPECS_DEFAUT_BASE = ['Cardiologue', 'Diabétologue', 'Endocrinologue', 'Généraliste'];
  function coeurDeCible() {
    var l = LS.get('coeurDeCible', null);
    return Array.isArray(l) && l.length ? l.filter(function (x) { return x && x !== 'Pharmacien'; }) : SPECS_DEFAUT_BASE.slice();
  }
  function sauverCoeurDeCible(l) {
    var propre = (l || []).filter(function (x) { return x && x !== 'Pharmacien'; });
    if (propre.length) {
      LS.set('coeurDeCible', propre.slice());
      SPECS_DEFAUT = propre.slice();
      FILTRES_VIDES.specialites = propre.slice();
    }
  }
  var SPECS_DEFAUT = coeurDeCible();
  var FILTRES_VIDES = { specialites: SPECS_DEFAUT.slice(), communes: [], potentiels: [], visite: 'tous', conv: 'tous', type: 'tous', equipe: 'tous' };
  S.ui.filtres = Object.assign({}, FILTRES_VIDES, LS.get('filtres', {}));
  S.ui.pharmaciesProches = S.ui.tab === 'autour' ? LS.get('proches', false) : false;
  if (S.ui.pharmaciesProches === true) S.ui.pharmaciesProches = 'Pharmacie';
  S.ui.filtresAutour = Object.assign({}, FILTRES_VIDES, LS.get('filtresAutour', {}));
  // « Pharmacien » n'est plus une spécialité filtrable (2.2.4)
  [S.ui.filtres, S.ui.filtresAutour].forEach(function (f) { f.specialites = (f.specialites || []).filter(function (x) { return x !== 'Pharmacien'; }); });
  if (!LS.get('specsDefaut325', false) || !LS.get('coeurCible32525', false)) {
    if (!S.ui.filtres.specialites || !S.ui.filtres.specialites.length) S.ui.filtres.specialites = coeurDeCible();
    if (!S.ui.filtresAutour.specialites || !S.ui.filtresAutour.specialites.length) S.ui.filtresAutour.specialites = coeurDeCible();
    LS.set('filtres', S.ui.filtres); LS.set('filtresAutour', S.ui.filtresAutour);
  }
  // 2.2.0 : nouveaux réglages par défaut (une seule fois)
  if (!LS.get('defauts220', false)) {
    S.ui.autour.moment = 'maintenant'; S.ui.autour.rayon = 0.5; LS.set('autour', S.ui.autour);
    S.ui.couvPortee = 'jour'; S.ui.couvFiltre = 'couvertes'; LS.set('couvPortee', 'jour'); LS.set('couvFiltre', 'couvertes');
    LS.set('defauts220', true);
  }
  // Contacts et Autour ont chacun leur propre jeu de filtres, conservé jusqu'à modification
  function cleFiltres() { return 'filtres'; }
  function filtresCour() { return S.ui[cleFiltres()]; }
  function rechercheCour() { return S.ui.tab === 'autour' ? S.ui.rechercheAutour : S.ui.recherche; }
  function majFiltres(f) {
    if (f && Array.isArray(f.specialites) && f.specialites.length) sauverCoeurDeCible(f.specialites);
    S.ui[cleFiltres()] = f;
    LS.set(cleFiltres(), f);
    S.ui.limite = 40;
    // 3.25.35 : Harmonisation totale avec le filtre maître (Recherche / Répertoire)
    if (f) {
      if (Array.isArray(f.communes)) {
        S.params.communes = f.communes.slice();
        LS.set('params', S.params);
        if (S.ui.filtresAutour) {
          S.ui.filtresAutour.communes = f.communes.slice();
          LS.set('filtresAutour', S.ui.filtresAutour);
        }
      }
      if (Array.isArray(f.specialites)) {
        S.params.specialites = f.specialites.slice();
        LS.set('params', S.params);
        if (S.ui.filtresAutour) {
          S.ui.filtresAutour.specialites = f.specialites.slice();
          LS.set('filtresAutour', S.ui.filtresAutour);
        }
      }
      if (Array.isArray(f.potentiels)) {
        S.params.potentiels = f.potentiels.slice();
        LS.set('params', S.params);
      }
    }
  }
  S.ui.stats = Object.assign({ periode: 'semaine', debut: '', fin: '', portee: 'moi', objectif: 40, vueSpec: 'base' }, LS.get('stats', {}));
  // L'ancienne tournée publiée est retirée de la feuille Plannings pour ne pas bloquer les collègues
  if (ancienPlan) {
    var auj = aujourdhui();
    S.ui.portee = { debut: ajouterJours(auj, -7), fin: ajouterJours(auj, 28) }; LS.set('portee', S.ui.portee);
    S.ui.aPublier = true; LS.set('aPublier', true);
  }
  var defautParams = { mode: 'semaine', dateRef: semaineParDefaut(aujourdhui()), communes: [], parJour: false,
                       communesJour: {}, maxJour: 8, delai: 7, eviterCollegues: true,
                       specialites: coeurDeCible(), typeCibles: 'medecins', potentiels: [] };
  S.params = Object.assign({}, defautParams, S.params || {});
  if (!Array.isArray(S.params.communes)) S.params.communes = [];
  if (!Array.isArray(S.params.specialites)) S.params.specialites = [];
  if (!LS.get('specsDefaut325', false) || !LS.get('coeurCible32525', false)) {
    if (!S.params.specialites.length) S.params.specialites = coeurDeCible();
    else sauverCoeurDeCible(S.params.specialites);
    LS.set('params', S.params); LS.set('specsDefaut325', true); LS.set('coeurCible32525', true);
  }
  // v2.0.4 : par défaut, tournée sans pharmacies (réglage appliqué une fois aux téléphones existants)
  if (!S.params.defauts204) { S.params.typeCibles = 'medecins'; S.params.defauts204 = true; LS.set('params', S.params); }
  if (!Array.isArray(S.params.potentiels)) S.params.potentiels = [];
  // 3.25.35 : Harmonisation immédiate de tous les filtres de l'application (le filtre maître est dans Répertoire / Recherche)
  if (S.ui.filtres && Array.isArray(S.ui.filtres.communes) && S.ui.filtres.communes.length) {
    S.params.communes = S.ui.filtres.communes.slice();
    if (S.ui.filtresAutour) S.ui.filtresAutour.communes = S.ui.filtres.communes.slice();
    LS.set('params', S.params);
    LS.set('filtresAutour', S.ui.filtresAutour);
  } else if (S.params && Array.isArray(S.params.communes) && S.params.communes.length) {
    S.ui.filtres.communes = S.params.communes.slice();
    if (S.ui.filtresAutour) S.ui.filtresAutour.communes = S.params.communes.slice();
    LS.set('filtres', S.ui.filtres);
    LS.set('filtresAutour', S.ui.filtresAutour);
  }
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
    declencherBackgroundSync();
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
  function quartiers() {
    var def = quartiersDefautObjets();
    if (!S.data || !S.data.quartiers || !S.data.quartiers.length) return def;
    var existants = {}, res = [];
    S.data.quartiers.forEach(function (q) {
      var cle = (q.quartier || '').trim().toLowerCase();
      if (cle) { existants[cle] = true; res.push(q); }
    });
    def.forEach(function (q) {
      var cle = (q.quartier || '').trim().toLowerCase();
      if (!existants[cle]) res.push(q);
    });
    return res;
  }
  function nomSecteur(q, com, coord) {
    var s = (q && q !== 'NL' && q !== 'Non localisé') ? String(q).trim() : '';
    if (com && s.toLowerCase().indexOf(com.toLowerCase()) === 0) {
      var rNom = s.slice(com.length).replace(/^[\s\-_/]+/, '').trim();
      if (rNom) s = rNom;
    }
    // Exception Cocody Centre : ne jamais réduire à simple "Centre"
    if ((/cocody/i.test(com) || /cocody/i.test(q) || /cocody/i.test(s)) && s.toLowerCase() === 'centre') {
      s = 'Cocody Centre';
    }
    if ((!s || s.toLowerCase() === (com || '').toLowerCase()) && coord && isFinite(coord.lat) && isFinite(coord.lon)) {
      var r = Moteur.quartierLePlusProche(coord.lat, coord.lon, quartiers());
      if (r && r.quartier && r.quartier.quartier) s = r.quartier.quartier;
    }
    if ((/cocody/i.test(com) || /cocody/i.test(s)) && s.toLowerCase() === 'centre') {
      s = 'Cocody Centre';
    }
    return s || com || '';
  }
  function formaterDureeTrajet(m) {
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return r > 0 ? (h + ' h ' + pad2(r)) : (h + ' h');
  }

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
    var t = String(s === undefined || s === null ? '' : s).replace(/\s{2,}/g, ' ');
    return t.replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateCourte(iso) { var p = iso.split('-'); return JOURS_COURTS[jourSemaineIndex(iso)] + ' ' + p[2] + '/' + p[1]; }
  function dateLongue(iso) { var p = iso.split('-'); return nomJour(iso).toLowerCase() + ' ' + (+p[2]) + ' ' + MOIS[+p[1] - 1]; }
  function majuscule(s) { return s.replace(/^./, function (c) { return c.toUpperCase(); }); }
  var MOIS_COURTS_CAP = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
  function datePlanLibelle(iso) {
    if (!iso) return '';
    var p = String(iso).slice(0, 10).split('-');
    if (p.length !== 3) return iso;
    var jCourt = majuscule(JOURS_COURTS[jourSemaineIndex(iso)] || '');
    if (!jCourt.endsWith('.')) jCourt += '.';
    return jCourt + ' ' + (+p[2]) + ' ' + (MOIS_COURTS_CAP[+p[1] - 1] || '');
  }
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
  function estGrandeCommune(nom) {
    if (!nom) return false;
    var s = normaliser(nom);
    return s.indexOf('abobo') === 0 || s.indexOf('cocody') === 0 || s.indexOf('yopougon') === 0;
  }
  function communeParente(nom) {
    if (!nom) return '';
    var s = String(nom).trim();
    var m = s.match(/^(Abobo|Cocody|Yopougon)\b/i);
    if (m) {
      var p = m[1].toLowerCase();
      if (p === 'abobo') return 'Abobo';
      if (p === 'cocody') return 'Cocody';
      if (p === 'yopougon') return 'Yopougon';
    }
    return s;
  }
  var ORDRE_SECTEURS = [
    // 1. Cocody
    'Cocody – Angré',
    'Cocody – Deux Plateaux',
    'Cocody – Riviera',
    'Cocody – Centre',
    // 2. Yopougon
    'Yopougon – Niangon',
    'Yopougon – Maroc & Toits Rouges',
    'Yopougon – Centre & Mairie',
    'Yopougon – Sud & Gesco',
    // 3. Abobo
    'Abobo – Nord & PK18',
    'Abobo – Centre & Mairie',
    'Abobo – Baoulé & Avocatier',
    'Abobo – Sud & Plaque'
  ];
  function secteursDeGrandeCommune(par) {
    if (par === 'Cocody') return ['Cocody – Angré', 'Cocody – Deux Plateaux', 'Cocody – Riviera', 'Cocody – Centre'];
    if (par === 'Yopougon') return ['Yopougon – Niangon', 'Yopougon – Maroc & Toits Rouges', 'Yopougon – Centre & Mairie', 'Yopougon – Sud & Gesco'];
    if (par === 'Abobo') return ['Abobo – Nord & PK18', 'Abobo – Centre & Mairie', 'Abobo – Baoulé & Avocatier', 'Abobo – Sud & Plaque'];
    var qs = (typeof quartiers === 'function') ? quartiers() : [];
    var set = {};
    qs.forEach(function (q) {
      if (communeParente(q.commune) === par && q.commune !== par) {
        set[q.commune] = true;
      }
    });
    return Object.keys(set).sort(function (a, b) {
      var ia = ORDRE_SECTEURS.indexOf(a), ib = ORDRE_SECTEURS.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      return a.localeCompare(b, 'fr');
    });
  }
  function communesListe() {
    var vus = {}, l = [];
    quartiers().forEach(function (q) {
      var com = communeParente(q.commune);
      if (!vus[com]) { vus[com] = true; l.push({ commune: com, zone: q.zone }); }
    });
    return l.sort(function (a, b) { return ZONES.indexOf(a.zone) - ZONES.indexOf(b.zone) || a.commune.localeCompare(b.commune, 'fr'); });
  }
  // Condensation intelligente des communes et secteurs :
  // 1. Si tous les secteurs d'une grande commune sont sélectionnés -> affiche uniquement le nom de la commune (ex: Cocody)
  // 2. Si seuls certains secteurs sont sélectionnés -> affiche uniquement le nom du secteur sans répéter la commune (ex: Deux Plateaux, Riviera)
  function condenserCommunesEtSecteurs(liste) {
    if (!liste || !liste.length) return '';
    var grandes = ['Abobo', 'Cocody', 'Yopougon'];
    var secsParGrande = {};
    grandes.forEach(function (g) {
      secsParGrande[g] = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(g) : [];
    });

    var compteParGrande = {};
    grandes.forEach(function (g) { compteParGrande[g] = 0; });

    liste.forEach(function (x) {
      if (!x) return;
      var str = String(x).trim();
      var par = (typeof communeParente === 'function') ? communeParente(str) : '';
      if (grandes.indexOf(par) >= 0) {
        if (secsParGrande[par] && secsParGrande[par].indexOf(str) >= 0) {
          compteParGrande[par]++;
        } else if (str === par || str === par + ' (Toute la commune)') {
          compteParGrande[par] = (secsParGrande[par] || []).length;
        }
      }
    });

    var resultats = [];
    var grandesTraitees = {};

    // 1. Pour les grandes communes dont TOUS les secteurs sont sélectionnés -> juste le nom de la commune (ex: Cocody)
    grandes.forEach(function (g) {
      var nbTot = (secsParGrande[g] || []).length;
      if (nbTot > 0 && compteParGrande[g] >= nbTot) {
        resultats.push(g);
        grandesTraitees[g] = true;
      }
    });

    // 2. Pour les autres éléments :
    liste.forEach(function (x) {
      if (!x) return;
      var str = String(x).trim();
      var par = (typeof communeParente === 'function') ? communeParente(str) : '';
      if (grandesTraitees[par]) return;

      // Si c'est un sous-secteur individuel d'une grande commune, on retire le préfixe redondant
      var nomAffiche = str.replace(/^(Abobo|Cocody|Yopougon)\s*[-–—]\s*/i, '')
                          .replace(/\s*\(Toute la commune\)$/i, '');
      // Exception Cocody Centre : "souvent Cocody Centre est seulement écrit Centre, ça prête à confusion, garder exceptionnellement Cocody Centre"
      if (par === 'Cocody' && nomAffiche.toLowerCase() === 'centre') {
        nomAffiche = 'Cocody Centre';
      }
      if (resultats.indexOf(nomAffiche) < 0) {
        resultats.push(nomAffiche);
      }
    });

    return resultats.join(', ');
  }

  function libelleCommunes(l) {
    if (!l || !l.length) return 'Toutes les communes';
    var r = condenserCommunesEtSecteurs(l);
    var parts = r ? r.split(', ') : [];
    if (!parts.length) return 'Toutes les communes';
    return parts.length <= 3 ? parts.join(', ') : parts.slice(0, 2).join(', ') + ' et ' + (parts.length - 2) + ' autres';
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
  // 3.25.15 : + Médecin / + Pharmacie (Journée) : toujours les filtres de l'onglet Recherche, type imposé
  function filtresRechercheType(type) { return Object.assign(JSON.parse(JSON.stringify(S.ui.filtres)), { type: type }); }
  function filtreAjout() {
    var f = S.ui.typeAjout ? filtresRechercheType(S.ui.typeAjout) : S.ui.filtres;
    var ok = ensemble(filtrerPraticiens(f, '').map(function (p) { return p.code; }));
    return function (p) { return !!ok[p.code]; };
  }
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
  // Détermine si toutes les spécialités cibles (ou toutes les spécialités médicales) sont sélectionnées
  function sontToutesSpecialites(specs) {
    if (!specs || !specs.length) return true;
    if (typeof memeEnsembleSpecs === 'function' && typeof coeurDeCible === 'function' && memeEnsembleSpecs(specs, coeurDeCible())) return true;
    var tot = specialitesListe();
    if (tot.length > 0 && specs.length >= tot.length) return true;
    if (specs.length >= 4) return true;
    return false;
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
    var waHref = (estMobile() && !S.config.waWeb) ? 'whatsapp://send?phone=' + num : 'https://wa.me/' + num;
    return '<div class="actions-rapides" role="group" aria-label="Actions rapides">' +
      lien('tel:' + tel, 'tel', 'Appeler', !!tel) + lien('sms:' + tel, 'sms', 'SMS', !!tel) +
      lien(waHref, 'whatsapp', 'WhatsApp', !!num, !estMobile() || S.config.waWeb) + lien(gmaps, 'carte', 'Maps', true, true) + '</div>';
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
      var matchQ = !q || normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')).indexOf(q) >= 0;
      var dataLib = esc(normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')));

      if (op.parent) {
        var secsDuPar = (typeof secteursDeGrandeCommune === 'function') ? secteursDeGrandeCommune(op.commune) : [];
        var toutCoche = secsDuPar.length > 0 && secsDuPar.every(function (s) { return sel && sel[s]; });
        var nbCoches = secsDuPar.filter(function (s) { return sel && sel[s]; }).length;
        var sousLib = toutCoche ? 'Tous les secteurs cochés' : (nbCoches > 0 ? nbCoches + '/' + secsDuPar.length + ' secteur' + (nbCoches > 1 ? 's' : '') : 'Toute la commune');
        return '<div class="commune-parent-ligne"' + (!matchQ ? ' hidden' : '') + '>' +
          '<button type="button" class="puce puce-parente" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
          '" data-parent="1" data-lib="' + dataLib + '" aria-pressed="' + toutCoche + '">' +
          '<span class="parente-gauche">' + icone('localisation') + '<b>' + esc(op.commune) + '</b></span>' +
          '<span class="parente-badge">' + esc(sousLib) + '</span></button></div>';
      }
      if (op.estSecteur) {
        var iconeCoche = actif ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7"/></svg>' : '';
        return '<button type="button" class="puce puce-secteur" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
          '" data-lib="' + dataLib + '" aria-pressed="' + actif + '"' + (!matchQ ? ' hidden' : '') + '>' +
          '<span class="sec-nom">' + iconeCoche + esc(op.nomCourt || op.lib) + '</span>' +
          (op.sousTitre ? '<small class="sec-reperes">' + esc(op.sousTitre) + '</small>' : '') +
          '</button>';
      }
      return '<button type="button" class="puce" data-a="choix" data-chemin="' + o.chemin + '" data-m="' + (o.multiple ? 1 : 0) + '" data-v="' + esc(op.v) +
        '" data-lib="' + dataLib + '" aria-pressed="' + actif + '"' + (!matchQ ? ' hidden' : '') + '>' +
        esc(op.lib) + (op.n !== undefined ? '<small>' + op.n + '</small>' : '') + '</button>';
    }
    var nb = o.multiple ? val.length : 0;
    var totalOpts = o.sections ? o.sections.reduce(function (s, sec) { return s + sec.options.length; }, 0) : (o.options ? o.options.length : 0);
    var resume = o.multiple ? (nb ? (nb <= 2 ? val.join(', ') : nb + ' choisis') : (o.resume || 'Tous')) : '';
    var h = '<section class="groupe-filtre' + (ouvert ? ' ouvert' : '') + '" data-groupe="' + o.id + '">' +
      '<div class="groupe-tete">' + (o.repliable ? '<button type="button" class="groupe-bascule" data-a="basculeGroupe" data-v="' + o.id + '" aria-expanded="' + ouvert + '">' : '<div class="groupe-bascule">') +
      '<b>' + esc(o.titre) + '</b>' + (nb ? '<span class="compteur">' + nb + '</span>' : '') + (o.repliable ? '<small>' + esc(resume) + '</small>' + icone('chevron') + '</button>' : '</div>') +
      (o.multiple && ouvert ? '<span class="groupe-actions"><button type="button" class="lien-action" data-a="groupeTout" data-chemin="' + o.chemin + '">Tous</button>' +
        (nb ? '<button type="button" class="lien-action" data-a="groupeAucun" data-chemin="' + o.chemin + '">Effacer</button>' : '') + '</span>' : '') + '</div>';
    if (!ouvert) return h + '</section>';
    if (o.aide) h += '<p class="discret groupe-aide">' + esc(o.aide) + '</p>';
    if (o.recherche) h += '<div class="recherche petite">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="' + o.id + '" placeholder="Rechercher…" value="' +
      esc((f.q && f.q[o.id]) || '') + '" aria-label="Rechercher dans ' + esc(o.titre) + '"></div>';
    if (o.sections) {
      // 3.25.31 : sections repliables en accordéon (zones géographiques, quartiers…)
      var accCle = o.accordeon || o.id || 'sections';
      var memo = LS.get('secOuverte', {});
      var ouv = (f.secOuvertes && f.secOuvertes[accCle] !== undefined)
        ? f.secOuvertes[accCle]
        : (f.secOuverte !== undefined && accCle === 'l' ? f.secOuverte : undefined);
      if (ouv === undefined || ouv === null) {
        if (o.multiple) {
          var secAvecSel = o.sections.filter(function (sec) {
            return !sec.fermeeParDefaut && sec.options.some(function (op) { return sel && sel[op.v]; });
          })[0];
          var premiereSecDispo = o.sections.filter(function (sec) { return !sec.fermeeParDefaut; })[0] || o.sections[0];
          ouv = secAvecSel ? secAvecSel.titre : (memo[accCle] !== undefined ? memo[accCle] : (premiereSecDispo ? premiereSecDispo.titre : ''));
        } else {
          var secAvecVal = o.sections.filter(function (sec) {
            return !sec.fermeeParDefaut && sec.options.some(function (op) { return op.v === val; });
          })[0];
          var premiereSecDispo = o.sections.filter(function (sec) { return !sec.fermeeParDefaut; })[0] || o.sections[0];
          ouv = secAvecVal ? secAvecVal.titre : (memo[accCle] !== undefined ? memo[accCle] : (premiereSecDispo ? premiereSecDispo.titre : ''));
        }
        f.secOuvertes = f.secOuvertes || {};
        f.secOuvertes[accCle] = ouv;
      }
      o.sections.forEach(function (sec) {
        var nbSel = o.multiple ? sec.options.filter(function (op) { return sel && sel[op.v]; }).length : (sec.options.some(function (op) { return op.v === val; }) ? 1 : 0);
        var nbTot = sec.options.length;
        var aMatch = !q || sec.options.some(function (op) { return normaliser(op.lib + ' ' + (op.nomCourt || '') + ' ' + (op.sousTitre || '')).indexOf(q) >= 0; });
        var ferme = q ? !aMatch : (ouv !== sec.titre);
        var ariaExp = q ? aMatch : !ferme;

        var corpsSec = '';
        var aDesSecteurs = sec.options.some(function (op) { return op.estSecteur || op.parent; });
        var estGroupeCommunes = aDesSecteurs || o.id === 'communes' || o.id === 'com';
        if (estGroupeCommunes) {
          var bufferSimples = [];
          var bufferSecteurs = [];
          function flushSimples() {
            if (bufferSimples.length) {
              corpsSec += '<div class="grille-communes-simples">' + bufferSimples.map(puce).join('') + '</div>';
              bufferSimples = [];
            }
          }
          function flushSecteurs() {
            if (bufferSecteurs.length) {
              corpsSec += '<div class="grille-secteurs">' + bufferSecteurs.map(puce).join('') + '</div>';
              bufferSecteurs = [];
            }
          }
          sec.options.forEach(function (op) {
            if (op.parent) {
              flushSimples();
              flushSecteurs();
              corpsSec += puce(op);
            } else if (op.estSecteur) {
              flushSimples();
              bufferSecteurs.push(op);
            } else {
              flushSecteurs();
              bufferSimples.push(op);
            }
          });
          flushSimples();
          flushSecteurs();
        } else {
          corpsSec = sec.options.map(puce).join('');
        }

        h += '<div class="section-choix' + (ariaExp ? ' ouverte' : '') + (nbSel ? ' a-selection' : '') + '"' + (q && !aMatch ? ' hidden' : '') + '>' +
          '<div class="section-choix-tete">' +
          '<button type="button" class="aire-titre aire-bascule" data-a="sectionBascule" data-acc="' + esc(accCle) + '" data-v="' + esc(sec.titre) + '" aria-expanded="' + ariaExp + '">' +
          '<span class="sec-titre">' + esc(sec.titre) + '</span>' +
          (nbSel ? '<span class="compteur">' + nbSel + '</span>' : '') +
          '<small>' + nbTot + '</small>' + icone('chevron') + '</button>' +
          (o.multiple ? '<button type="button" class="lien-action section-tous" data-a="sectionToute" data-chemin="' + o.chemin + '" title="Tout sélectionner ou effacer dans ' + esc(sec.titre) + '">Tous</button>' : '') +
          '</div>' +
          '<div class="puces" data-ferme="' + (ferme ? 1 : 0) + '"' + (ferme && !q ? ' hidden' : '') + '>' + corpsSec + '</div></div>';
      });
    } else {
      var puceTous = o.multiple && totalOpts > 1 && !q
        ? '<button type="button" class="puce puce-tous" data-a="' + (o.tousVide ? 'groupeAucun' : 'groupeToutToggle') + '" data-chemin="' + o.chemin + '" aria-pressed="' + (o.tousVide ? (!nb || nb === totalOpts) : nb === totalOpts) + '">Tous</button>'
        : '';
      h += '<div class="puces">' + puceTous + o.options.map(puce).join('') + '</div>';
    }
    return h + '</section>';
  }
  function cheminObjet(chemin) {
    var o = S.ui.feuille, k = chemin.split('.');
    for (var i = 0; i < k.length - 1; i++) o = o[k[i]];
    return { o: o, k: k[k.length - 1] };
  }
  function valeurChemin(chemin) { var c = cheminObjet(chemin); return c.o[c.k]; }
  function sectionsCommunes() {
    var secs = [];
    var qs = (typeof quartiers === 'function') ? quartiers() : [];
    var groupes = {};
    var quartiersParSecteur = {};

    qs.forEach(function (q) {
      var sec = q.commune;
      quartiersParSecteur[sec] = quartiersParSecteur[sec] || [];
      if (quartiersParSecteur[sec].indexOf(q.quartier) < 0) {
        quartiersParSecteur[sec].push(q.quartier);
      }
      var z = q.zone || 'Zone Autre';
      groupes[z] = groupes[z] || {};
      var par = communeParente(sec);
      groupes[z][par] = groupes[z][par] || [];
      if (groupes[z][par].indexOf(sec) < 0) {
        groupes[z][par].push(sec);
      }
    });

    // 3.26.7 : Garantir systématiquement la présence des 3 grandes communes et de leurs 4 secteurs
    groupes['Zone Nord'] = groupes['Zone Nord'] || {};
    groupes['Zone Nord']['Abobo'] = secteursDeGrandeCommune('Abobo');
    groupes['Zone Est'] = groupes['Zone Est'] || {};
    groupes['Zone Est']['Cocody'] = secteursDeGrandeCommune('Cocody');
    groupes['Zone Ouest'] = groupes['Zone Ouest'] || {};
    groupes['Zone Ouest']['Yopougon'] = secteursDeGrandeCommune('Yopougon');

    var zonesOrdonnees = ZONES.slice();
    Object.keys(groupes).forEach(function (z) { if (zonesOrdonnees.indexOf(z) < 0) zonesOrdonnees.push(z); });

    var reperesOfficiels = {
      'Cocody – Angré': 'Angré · 7e/8e tranche · CHU',
      'Cocody – Deux Plateaux': 'Vallons · Aghien · Attoban',
      'Cocody – Riviera': 'Riviera 2-4 · Palmeraie · Faya',
      'Cocody – Centre': 'Saint-Jean · Danga · CHU · Mermoz',
      'Yopougon – Niangon': 'Nord · Sud · Académie · Cité Verte',
      'Yopougon – Maroc & Toits Rouges': 'Maroc · Toits Rouges · Sideci',
      'Yopougon – Centre & Mairie': 'CHU · Saint-André · Siporex',
      'Yopougon – Sud & Gesco': 'Port-Bouët 2 · Selmer · Gesco',
      'Abobo – Nord & PK18': 'PK 18 · N\'Dotré · Belle Ville',
      'Abobo – Centre & Mairie': 'Samaké · Gare · Mairie · Habitat',
      'Abobo – Baoulé & Avocatier': 'Abobo Baoulé · Avocatier · SOTRA',
      'Abobo – Sud & Plaque': 'Sagbé · Plaque 1-2 · Anador'
    };

    zonesOrdonnees.forEach(function (z) {
      if (!groupes[z]) return;
      var opts = [];
      var parents = Object.keys(groupes[z]).sort(function (a, b) { return a.localeCompare(b, 'fr'); });
      parents.forEach(function (par) {
        var estGrande = estGrandeCommune(par);
        var secteurs = estGrande ? secteursDeGrandeCommune(par) : (groupes[z][par] || []);
        if (!estGrande) {
          // Commune standard non segmentée (Plateau, Adjamé, Marcory, Port-Bouët, Bingerville...)
          opts.push({ v: par, lib: par, commune: par });
        } else {
          // Seules les 3 grandes communes (Abobo, Cocody, Yopougon) sont segmentées en 4 sous-secteurs
          opts.push({ v: par, lib: par + ' (Toute la commune)', parent: true, commune: par });
          secteurs.sort(function (a, b) {
            var ia = ORDRE_SECTEURS.indexOf(a), ib = ORDRE_SECTEURS.indexOf(b);
            if (ia >= 0 && ib >= 0) return ia - ib;
            return a.localeCompare(b, 'fr');
          }).forEach(function (sec) {
            var nomCourt = sec.replace(/^(Abobo|Cocody|Yopougon)\s*[-–—]\s*/i, '');
            // Exception Cocody Centre : garder exceptionnellement Cocody Centre
            if (par === 'Cocody' && nomCourt.toLowerCase() === 'centre') {
              nomCourt = 'Cocody Centre';
            }
            var rep = reperesOfficiels[sec] || (quartiersParSecteur[sec] || []).slice(0, 3).join(' · ');
            opts.push({
              v: sec,
              lib: sec,
              nomCourt: nomCourt,
              sousTitre: rep,
              estSecteur: true,
              commune: par
            });
          });
        }
      });
      if (opts.length) secs.push({ titre: z, options: opts });
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
    var qs = quartiers();
    var grandAbidjanComs = [
      'Abobo', 'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville',
      'Cocody', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët',
      'Songon', 'Treichville', 'Yopougon'
    ];
    var grandAbidjanNorm = grandAbidjanComs.map(normaliser);

    var par = {};
    var interieur = [];

    qs.forEach(function (q) {
      var nomQ = (q.quartier || '').trim();
      if (!nomQ || /^NL$/i.test(nomQ)) return;
      var com = (q.commune || '').trim().replace(/\s*-\s*/g, ' – ');
      var zone = (q.zone || '').trim();
      var estInt = zone === 'Zone Intérieur' || zone === 'Zone Interieur' ||
                   (zone && zone.toLowerCase().indexOf('intérieur') >= 0) ||
                   (zone && zone.toLowerCase().indexOf('interieur') >= 0) ||
                   (com && com.toLowerCase().indexOf('intérieur') >= 0) ||
                   (com && com.toLowerCase().indexOf('interieur') >= 0);

      var parent = (typeof communeParente === 'function') ? communeParente(com) : com;
      var normParent = normaliser(parent || '');
      if (!estInt && grandAbidjanNorm.indexOf(normParent) < 0) {
        estInt = true;
      }

      if (estInt) {
        interieur.push({ v: nomQ, lib: nomQ + (com && com !== nomQ && !estInt ? ' (' + com + ')' : '') });
        return;
      }

      // Grand Abidjan : rattachement par commune et secteur
      var groupeTitre = com;
      if (normParent === 'cocody') {
        if (nomQ.toLowerCase() === 'centre' || nomQ.toLowerCase() === 'cocody centre') nomQ = 'Cocody Centre';
        groupeTitre = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Cocody', nomQ, '') : 'Cocody – Centre';
        if (!groupeTitre || groupeTitre === 'Cocody') groupeTitre = 'Cocody – Centre';
      } else if (normParent === 'yopougon') {
        groupeTitre = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Yopougon', nomQ, '') : 'Yopougon – Centre & Mairie';
        if (!groupeTitre || groupeTitre === 'Yopougon') groupeTitre = 'Yopougon – Centre & Mairie';
      } else if (normParent === 'abobo') {
        groupeTitre = (typeof zoneDeQuartier === 'function') ? zoneDeQuartier('Abobo', nomQ, '') : 'Abobo – Centre & Mairie';
        if (!groupeTitre || groupeTitre === 'Abobo') groupeTitre = 'Abobo – Centre & Mairie';
      } else {
        groupeTitre = parent || com;
      }

      groupeTitre = groupeTitre.replace(/\s*-\s*/g, ' – ');
      par[groupeTitre] = par[groupeTitre] || [];
      if (!par[groupeTitre].some(function (x) { return x[0] === nomQ; })) {
        par[groupeTitre].push([nomQ, nomQ]);
      }
    });

    var sections = [];
    var groupesOrdre = [
      'Cocody – Angré', 'Cocody – Deux Plateaux', 'Cocody – Riviera', 'Cocody – Centre',
      'Yopougon – Centre & Mairie', 'Yopougon – Maroc & Toits Rouges', 'Yopougon – Niangon', 'Yopougon – Sud & Gesco',
      'Abobo – Centre & Mairie', 'Abobo – Baoulé & Avocatier', 'Abobo – Nord & PK18', 'Abobo – Sud & Plaque',
      'Adjamé', 'Anyama', 'Attécoubé', 'Bingerville', 'Koumassi', 'Marcory', 'Plateau', 'Port-Bouët', 'Songon', 'Treichville'
    ];

    groupesOrdre.forEach(function (titre) {
      if (par[titre] && par[titre].length) {
        par[titre].sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
        sections.push({ titre: titre, options: par[titre] });
        delete par[titre];
      }
    });

    Object.keys(par).sort(function (a, b) { return a.localeCompare(b, 'fr'); }).forEach(function (k) {
      if (par[k] && par[k].length) {
        par[k].sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
        sections.push({ titre: k, options: par[k] });
      }
    });

    // Villes de l'intérieur tout en bas et masquées par défaut
    if (interieur.length) {
      var vuInt = {};
      var optsInt = [];
      interieur.forEach(function (it) {
        if (!vuInt[it.v]) {
          vuInt[it.v] = true;
          optsInt.push([it.v, it.lib]);
        }
      });
      optsInt.sort(function (a, b) { return a[1].localeCompare(b[1], 'fr'); });
      sections.push({
        titre: 'Villes de l\'intérieur',
        options: optsInt,
        fermeeParDefaut: true
      });
    }

    return sections;
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
  // 3.25.24 : Produits ordonnés comme dans l'onglet Produits et séparés en 2 gammes :
  // Gamme A (tous les Zyltan / Losartan AM, Lesstrol, Eurythmic, Tensicard) et Gamme B (les autres)
  function estGammeA(prod, gamme) {
    var k = normaliser(String(prod || '') + ' ' + String(gamme || ''));
    if (k.indexOf('lesskaa') >= 0) return false;
    return /zyltan|losartanam|lesstrol|lestrol|eurithmic|eurythmic|tensicard/.test(k);
  }
  function rangFamilleGammeA(prod, gamme) {
    var k = normaliser(String(prod || '') + ' ' + String(gamme || ''));
    if (/zyltan|losartanam/.test(k)) return 0;
    if (/lesstrol|lestrol/.test(k)) return 1;
    if (/eurithmic|eurythmic/.test(k)) return 2;
    if (/tensicard/.test(k)) return 3;
    return 9;
  }
  function estProduitActif(f) {
    if (!f) return false;
    if (f.actif !== undefined && f.actif !== null && f.actif !== '') {
      var a = String(f.actif).trim().toLowerCase();
      if (a === 'false' || a === 'faux' || a === '0' || a === 'non') return false;
    }
    return true;
  }
  function produitsParGamme() {
    var inactifs = {};
    var lFiches = (S.data && S.data.fiches) || [];
    lFiches.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });

    var brut = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    brut = brut.filter(function (p) { return !inactifs[normaliser(p)]; });
    var autorises = {};
    brut.forEach(function (p) { autorises[normaliser(p)] = true; });

    var fichesToutes = (typeof fichesProduits === 'function' ? fichesProduits() : FICHES_PRODUITS_DEFAUT) || [];
    // 3.25.40 : Le catalogue actif du CR correspond strictement aux produits de Listes!K
    var fiches = fichesToutes.filter(function (f) { return autorises[normaliser(f.produit)] && !inactifs[normaliser(f.produit)]; });
    if (!fiches.length) fiches = fichesToutes.filter(function (f) { return !inactifs[normaliser(f.produit)]; });
    var gammes = typeof gammesProduits === 'function' ? gammesProduits(fiches) : [];
    var gA = [], gB = [], vus = {};
    var famA = gammes.filter(function (g) { return estGammeA('', g.nom); }).slice().sort(function (a, b) {
      return rangFamilleGammeA('', a.nom) - rangFamilleGammeA('', b.nom);
    });
    var famB = gammes.filter(function (g) { return !estGammeA('', g.nom); });
    famA.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (f) {
        if (!vus[f.produit]) { vus[f.produit] = true; gA.push(f.produit); }
      });
    });
    famB.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '');
      g.fiches.slice().sort(function (x, y) { return (y.produit === nom) - (x.produit === nom); }).forEach(function (f) {
        if (!vus[f.produit]) { vus[f.produit] = true; gB.push(f.produit); }
      });
    });
    brut.forEach(function (p) {
      if (!p || vus[p] || inactifs[normaliser(p)] || (p === 'Lestrol 20' && vus['Lesstrol 20'])) return;
      vus[p] = true;
      if (estGammeA(p, '')) gA.push(p); else gB.push(p);
    });
    return { gammeA: gA, gammeB: gB, tous: gA.concat(gB) };
  }
  function famillesProduitsParGamme() {
    var pg = produitsParGamme();
    function filtrer(liste, re) { return liste.filter(function (p) { return re.test(normaliser(p)); }); }
    var zyltan = filtrer(pg.gammeA, /zyltan|losartanam/);
    var lesstrol = filtrer(pg.gammeA, /lesstrol|lestrol/);
    var autresA = pg.gammeA.filter(function (p) { return zyltan.indexOf(p) < 0 && lesstrol.indexOf(p) < 0; });
    var telmikaa = filtrer(pg.gammeB, /telmikaa/);
    var rozukaa = filtrer(pg.gammeB, /rozukaa/);
    var antiplatt = filtrer(pg.gammeB, /antiplatt/);
    var autresB = pg.gammeB.filter(function (p) { return telmikaa.indexOf(p) < 0 && rozukaa.indexOf(p) < 0 && antiplatt.indexOf(p) < 0; });
    return {
      A: [
        { id: 'Zyltan', titre: 'Zyltan', sous: 'Zyltan, H, AM, Losartan AM', produits: zyltan },
        { id: 'Lesstrol', titre: 'Lesstrol', sous: '20, AM, EZ', produits: lesstrol },
        { id: 'AutresA', titre: 'Eurythmic & Tensicard', sous: 'Rythme & bêtabloquant', produits: autresA }
      ].filter(function (f) { return f.produits.length > 0; }),
      B: [
        { id: 'Telmikaa', titre: 'Telmikaa', sous: 'Telmikaa, AM, H, AMH, CT', produits: telmikaa },
        { id: 'Rozukaa', titre: 'Rozukaa', sous: '10, 20, F, A, Gold', produits: rozukaa },
        { id: 'Antiplatt', titre: 'Antiplatt', sous: 'Antiplatt, Plus', produits: antiplatt },
        { id: 'AutresB', titre: 'Autres (Lesskaa, Myonit, Orlitroy, Troynuron)', sous: autresB.length + ' produits', produits: autresB }
      ].filter(function (f) { return f.produits.length > 0; })
    };
  }
  function produitsRef() { return produitsParGamme().tous; }
  function derniersProduitsCr() {
    var ref = produitsRef(), mem = LS.get('derniersProduitsCr', null);
    if (Array.isArray(mem)) return mem.filter(function (p) { return ref.indexOf(p) >= 0; });
    var l = S.plan.filter(function (a) { return a.statut && !estPharmacie(a) && a.produits; }).slice(-1)[0]
      || (S.queue || []).filter(function (v) { return v.type !== 'Pharmacie' && v.produits; }).slice(-1)[0]
      || ((S.data && S.data.historique) || []).filter(function (v) { return (!v.delegue || estMoi(v.delegue)) && v.type !== 'Pharmacie' && v.produits; })[0];
    return l ? listeProduits(l.produits).filter(function (p) { return ref.indexOf(p) >= 0; }) : [];
  }
  function memoriserDerniersProduitsCr(prods) {
    if (Array.isArray(prods)) LS.set('derniersProduitsCr', prods.slice());
  }
  function derniersProduitsStockCr() {
    var ref = produitsRef(), mem = LS.get('derniersProduitsStockCr', null);
    if (Array.isArray(mem)) return mem.filter(function (p) { return ref.indexOf(p) >= 0; });
    return [];
  }
  function memoriserDerniersProduitsStockCr(prods) {
    if (Array.isArray(prods)) LS.set('derniersProduitsStockCr', prods.slice());
  }
  var TYPES_COMMUNS_CR = ['Routine', 'Présentation', 'Échantillons', 'Cadeaux'];
  function groupesTypesCr(ph) {
    var base = ph ? activitesPharmacie().slice() : activites().slice();
    TYPES_COMMUNS_CR.forEach(function (t) { if (base.indexOf(t) < 0) base.unshift(t); });
    var communs = TYPES_COMMUNS_CR.filter(function (t) { return base.indexOf(t) >= 0; });
    var spec = base.filter(function (t) { return communs.indexOf(t) < 0; });
    return { communs: communs, specifiques: spec, tous: communs.concat(spec) };
  }
  function derniersTypesCr(ph) {
    var g = groupesTypesCr(ph), ref = g.tous, cle = ph ? 'derniersTypesPharma' : 'derniersTypesMed';
    var mem = LS.get(cle, null);
    if (Array.isArray(mem) && mem.length) {
      var f = mem.filter(function (x) { return ref.indexOf(x) >= 0; });
      if (f.length) return f;
    }
    var der = S.plan.filter(function (a) { return a.statut && estPharmacie(a) === !!ph && a.activite; }).slice(-1)[0]
      || (S.queue || []).filter(function (v) { return (v.type === 'Pharmacie') === !!ph && v.activite; }).slice(-1)[0]
      || ((S.data && S.data.historique) || []).filter(function (v) { return (!v.delegue || estMoi(v.delegue)) && (v.type === 'Pharmacie') === !!ph && v.activite; })[0];
    if (der) {
      var l = listeActivites(der.activite).filter(function (x) { return ref.indexOf(x) >= 0; });
      if (l.length) return l;
    }
    return ph ? ['Routine', 'Stocks'] : ['Routine', 'Présentation produit'];
  }
  function memoriserDerniersTypesCr(ph, types) {
    if (Array.isArray(types) && types.length) LS.set(ph ? 'derniersTypesPharma' : 'derniersTypesMed', types.slice());
  }
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
    var envoi = envoyerFiches().catch(function (errF) {
      console.warn('Erreur envoi fiches, poursuite des comptes rendus:', errF);
      return null;
    }).then(function () {
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
      localiser(true, 'sync', true);
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
      var actif = S.ui.tab === 'autour' || S.ui.tab === 'rapport' ? 'jour' : (S.ui.tab === 'recherche' || S.ui.tab === 'contacts' ? 'praticiens' : (S.ui.tab === 'suivi' ? (S.ui.suiviVue || 'bilan') : (S.ui.tab === 'audit' ? 'bilan' : S.ui.tab)));
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
    var aActif = document.activeElement;
    var infoFocus = null;
    if (aActif && (aActif.tagName === 'INPUT' || aActif.tagName === 'TEXTAREA')) {
      infoFocus = {
        id: aActif.id,
        f: aActif.dataset ? aActif.dataset.f : null,
        val: aActif.value,
        selStart: aActif.selectionStart,
        selEnd: aActif.selectionEnd
      };
    }
    var bjAvant = vue.querySelector('.bj-jours'), actAvant = bjAvant && bjAvant.querySelector('.bj-jour[aria-pressed="true"]');
    var dateAvant = actAvant && actAvant.dataset ? actAvant.dataset.v : null;
    if (bjAvant && S.ui.bjDepart === undefined && actAvant) {
      S.ui.bjAvantDate = dateAvant;
      S.ui.bjAvantLeft = actAvant.getBoundingClientRect().left - bjAvant.getBoundingClientRect().left;
    }
    vue.classList.remove('vue-entre', 'jour-glisse-d', 'jour-glisse-g');
    try {
      vue.innerHTML = (VUES[tab] || VUES.jour)();
      if (infoFocus) {
        var champCible = infoFocus.id ? $(infoFocus.id) : (infoFocus.f ? vue.querySelector('[data-f="' + infoFocus.f + '"]') : null);
        if (champCible) {
          champCible.focus();
          if (infoFocus.selStart !== null && infoFocus.selEnd !== null) {
            try { champCible.setSelectionRange(infoFocus.selStart, infoFocus.selEnd); } catch (eF) {}
          }
        }
      }
    } catch (errVue) {
      console.error('Erreur rendu vue ' + tab + ':', errVue);
      S.ui.tab = 'jour';
      S.ui.rechOuverte = false;
      LS.set('rechOuverte', false);
      LS.set('onglet', 'jour');
      try {
        vue.innerHTML = (VUES.jour || function () { return '<div class="vide">Erreur d\'affichage. Rechargement sur la journée...</div>'; })();
      } catch (e2) {
        vue.innerHTML = '<div class="vide"><strong>Erreur d\'affichage</strong>Touchez un onglet ci-dessous ou rechargez la page.</div>';
      }
    }
    animerRendu(tab, dateAvant); annoncer(tab === 'jour' ? 'Affichage de la journée' : (tab === 'semaine' ? 'Planifier' : tab));
    if (!vue.classList.contains('vue-entre') && Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
    centrerBandeJours();
    dessinerCartes();
    rendreFeuille();
    rendreLancement();
    afficherEntete(); afficherBarre(); afficherNav();
    datesEnFrancais();
    initGlisseHorizontale();
  }
  // 3.19.0 : animations discrètes, seulement quand quelque chose change vraiment
  // (nouvel écran, nouvelle question d'un parcours, carte qu'on vient d'ouvrir, compte rendu qu'on vient d'enregistrer)
  function animerRendu(tab, dateAvant) {
    var dCour = S.ui.jourVue || S.ui.jour || '';
    var v = $('vue'), cle = tab + '|' + (S.ui.rechOuverte ? 1 : 0) + '|' + (S.ui.voirParams ? 1 : 0) + '|' + dCour;
    var nouvelEcran = cle !== S.ui.cleVue;
    if (nouvelEcran) {
      void v.offsetWidth; v.classList.add('vue-entre');
      if (dateAvant && dCour && dateAvant !== dCour && (tab === 'jour' || tab === 'semaine')) {
        v.classList.add(dCour > dateAvant ? 'jour-glisse-d' : 'jour-glisse-g');
      }
      S.ui.cleVue = cle;
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
  // 3.26.31 : appui très long (~650ms) sur une date planifiée dans l'onglet Planifier (frise ou titre) pour la supprimer
  (function () {
    var timer = null, startX = 0, startY = 0, cibleDate = null, cibleEl = null, longPressFired = false;
    var dernierAppuiLongFired = 0;
    var dernierTouchTime = 0;
    var DUREE_APPUI_LONG = 650;

    function annulerAppuiLong() {
      if (timer) { clearTimeout(timer); timer = null; }
      if (cibleEl) { cibleEl.classList.remove('appui-long-actif'); cibleEl = null; }
      cibleDate = null;
      longPressFired = false;
    }

    function demarrerAppuiLong(e) {
      annulerAppuiLong();
      if (S.ui.tab !== 'semaine') return;

      // Détection sur n'importe quelle date planifiée de la frise OU sur le titre / en-tête de la journée
      var bjBtn = e.target && e.target.closest && e.target.closest('.frise-plan .bj-jour[data-v]');
      var tetePlan = e.target && e.target.closest && e.target.closest('.tete-jour-plan');
      if (!bjBtn && !tetePlan) return;

      var date = bjBtn ? bjBtn.dataset.v : S.ui.jour;
      if (!date) return;
      var nb = S.plan.filter(function (a) { return a.date === date; }).length;
      if (!nb && !S.jours[date] && datesPlan().indexOf(date) < 0) return;

      var pt = e.touches ? e.touches[0] : e;
      startX = pt.clientX;
      startY = pt.clientY;
      cibleDate = date;
      cibleEl = bjBtn || (tetePlan.querySelector('.bilan-jour') || tetePlan);
      cibleEl.classList.add('appui-long-actif');

      timer = setTimeout(function () {
        timer = null;
        longPressFired = true;
        dernierAppuiLongFired = Date.now();
        if (cibleEl) {
          cibleEl.classList.remove('appui-long-actif');
          cibleEl = null;
        }
        // Retour haptique : vibration au déclenchement sur smartphone compatible
        try {
          if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
        } catch (err) {}
        demanderSuppressionJour(date, nb);
      }, DUREE_APPUI_LONG);
    }

    function bougerAppuiLong(e) {
      if (!timer) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = Math.abs(pt.clientX - startX), dy = Math.abs(pt.clientY - startY);
      if (dx > 24 || dy > 24) annulerAppuiLong();
    }

    function terminerAppuiLong(e) {
      if (longPressFired) {
        dernierAppuiLongFired = Date.now();
        if (e && e.cancelable) e.preventDefault();
      }
      annulerAppuiLong();
    }

    // Touch events (mobiles & tablettes)
    document.addEventListener('touchstart', function (e) {
      dernierTouchTime = Date.now();
      if (e.touches && e.touches.length > 1) { annulerAppuiLong(); return; }
      demarrerAppuiLong(e);
    }, { passive: true });
    document.addEventListener('touchmove', bougerAppuiLong, { passive: true });
    document.addEventListener('touchend', terminerAppuiLong, { passive: false });
    document.addEventListener('touchcancel', function () {
      if (!longPressFired) annulerAppuiLong();
    }, { passive: true });

    // Pointer/Mouse events (ordinateurs & souris)
    document.addEventListener('mousedown', function (e) {
      if (Date.now() - dernierTouchTime < 1000) return;
      if (e.button !== 0) return;
      demarrerAppuiLong(e);
    });
    document.addEventListener('mousemove', bougerAppuiLong);
    document.addEventListener('mouseup', terminerAppuiLong);

    // Empêcher l'ouverture du menu contextuel Android / iOS lors de l'appui long
    // Crucial : ne pas appeler annulerAppuiLong() ici car contextmenu se déclenche vers ~500ms sur mobile !
    window.addEventListener('contextmenu', function (e) {
      if (cibleEl || longPressFired || (Date.now() - dernierAppuiLongFired < 1200)) {
        e.preventDefault();
      }
    }, true);

    // Bloquer impérativement tout clic parasite synthétisé lors du relâchement du doigt après un appui long
    // (évite notamment la fermeture immédiate de la feuille de confirmation par clic sur le voile,
    //  ou le basculement accidentel vers une autre date sur la frise sous-jacente)
    window.addEventListener('click', function (e) {
      if (Date.now() - dernierAppuiLongFired < 800) {
        // Laisser impérativement passer les clics sur les boutons de la boîte de dialogue modale
        if (e.target && e.target.closest && e.target.closest('.feuille-pied, .feuille-corps, .feuille-tete')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    }, true);
  })();
  // 3.25.24 : glissement fluide (courbe cubic-bezier) et cliqué-glissé avec inertie sur les bandeaux horizontaux
  function glisserHorizontal(el, depart, cible, duree) {
    if (!el) return;
    if (reduireAnimations() || Math.abs(cible - depart) < 2) { el.scrollLeft = cible; return; }
    if (el.__animId) cancelAnimationFrame(el.__animId);
    el.classList.add('anim-scroll');
    el.scrollLeft = depart;
    var t0 = performance.now(), d = duree || 360;
    function pas(t) {
      var p = Math.min(1, (t - t0) / d);
      var ease = 1 - Math.pow(1 - p, 3);
      el.scrollLeft = depart + (cible - depart) * ease;
      if (p < 1) el.__animId = requestAnimationFrame(pas);
      else { el.__animId = null; el.classList.remove('anim-scroll'); }
    }
    el.__animId = requestAnimationFrame(pas);
  }
  // bande des jours : le jour choisi glisse au centre (depuis la position précédente, pour garder le mouvement)
  function centrerBandeJours() {
    var b = document.querySelector('.bj-jours'), s = b && b.querySelector('.bj-jour[aria-pressed="true"]');
    if (!s) { S.ui.bjDepart = null; S.ui.bjAvantDate = null; return; }
    var cible = s.offsetLeft - (b.clientWidth - s.offsetWidth) / 2;
    if (S.ui.bjDepart !== undefined && S.ui.bjDepart !== null) {
      var dep = s.offsetLeft - S.ui.bjDepart;
      S.ui.bjDepart = null; S.ui.bjAvantDate = null;
      glisserHorizontal(b, dep, cible, 360);
    } else if (S.ui.bjAvantDate && S.ui.bjAvantDate !== s.dataset.v) {
      var ancien = b.querySelector('.bj-jour[data-v="' + S.ui.bjAvantDate + '"]');
      var dep2 = ancien ? ancien.offsetLeft - (S.ui.bjAvantLeft || (b.clientWidth - ancien.offsetWidth) / 2) : b.scrollLeft;
      S.ui.bjAvantDate = null;
      glisserHorizontal(b, dep2, cible, 380);
    } else {
      S.ui.bjAvantDate = null;
      b.scrollLeft = cible;
    }
  }
  function initGlisseHorizontale() {
    document.querySelectorAll('.bj-jours, .defile, .jours').forEach(function (el) {
      if (el.__glisseInit) return;
      el.__glisseInit = true;
      var actif = false, bouge = false, startX = 0, startScroll = 0, lastX = 0, lastT = 0, vx = 0;
      el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'touch' || e.button > 0) return;
        if (el.__animId) { cancelAnimationFrame(el.__animId); el.__animId = null; }
        actif = true; bouge = false; startX = lastX = e.clientX; startScroll = el.scrollLeft; lastT = performance.now(); vx = 0;
      });
      el.addEventListener('pointermove', function (e) {
        if (!actif) return;
        var dx = e.clientX - startX;
        if (!bouge && Math.abs(dx) > 5) { bouge = true; el.classList.add('en-glisse', 'anim-scroll'); }
        if (!bouge) return;
        var now = performance.now(), dt = Math.max(1, now - lastT);
        vx = (lastX - e.clientX) / dt;
        lastX = e.clientX; lastT = now;
        el.scrollLeft = startScroll - dx;
      });
      function fin() {
        if (!actif) return;
        actif = false;
        el.classList.remove('en-glisse');
        if (!bouge) { el.classList.remove('anim-scroll'); return; }
        el.__bloqueClic = Date.now() + 180;
        var cible = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + vx * 220));
        glisserHorizontal(el, el.scrollLeft, cible, 340);
      }
      el.addEventListener('pointerup', fin);
      el.addEventListener('pointercancel', fin);
      el.addEventListener('pointerleave', fin);
      el.addEventListener('click', function (e) {
        if (el.__bloqueClic && Date.now() < el.__bloqueClic) { e.stopPropagation(); e.preventDefault(); }
      }, true);
    });
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
    var p = S.params;
    if (p.mode === 'semaine' && p.parJour) {
      var j = p.communesJour[jourSemaineIndex(date)];
      if (j && j.length) return j;
    }
    // 3.25.35 : Le filtre maître est dans Répertoire (S.ui.filtres.communes)
    var fCom = (S.ui.filtres && Array.isArray(S.ui.filtres.communes) && S.ui.filtres.communes.length) ? S.ui.filtres.communes : p.communes;
    return fCom && fCom.length ? fCom : null;
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
      '<p class="sous-titre">Déroulez votre tournée dans l\'ordre : itinéraire GPS, contacts praticiens et comptes rendus.</p>' +
      '<div class="bande-jours">' +
        '<div class="bj-jours" role="group" aria-label="Jours">' + jours.map(function (x) {
          var n = nbVisitesJour(x);
          return '<button type="button" class="bj-jour' + (x === t ? ' aujourdhui' : '') + (jourSemaineIndex(x) === 0 ? ' lundi' : '') + '" data-a="jourAller" data-v="' + x + '" aria-pressed="' + (x === d) + '"><small>' +
            JOURS_COURTS[jourSemaineIndex(x)].replace('.', '') + '</small><b>' + (+x.slice(8)) + '</b><em>' + MOIS_ABREGES[+x.slice(5, 7) - 1] + '</em><i>' + (n ? n : '') + '</i></button>';
        }).join('') + '</div>' +
        '<button type="button" class="bj-cal" data-a="calOuvrir" aria-label="Choisir une date">' + icone('calendrier') + '</button></div>';
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
    // 3.25.15 : aujourd'hui, avec ma position : les visites pas encore vues du plus proche au plus loin
    var gp = d === t && S.ui.posGps && Date.now() - S.ui.posGps.t < 15 * 60000 ? S.ui.posGps : null, parProximite = false;
    if (gp) {
      var dm = {}; aFaire.forEach(function (a) { var c = coordPrecise(a) || coordArret(a); dm[a.uid] = c ? distanceVol(gp, c) : 99; });
      aFaire.sort(function (x, y) { return dm[x.uid] - dm[y.uid]; }); parProximite = true;
    }
    ['Matin', 'Soir'].forEach(function (cren) {
      var liste = aFaire.filter(function (a) { return a.creneau === cren; });
      if (!liste.length) return;
      h += '<div class="creneau-titre">' + cren + '</div><ol class="ligne">';
      liste.forEach(function (a, i) {
        if (i > 0 && a.dist > 0 && !parProximite) {
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
    var R = rapportDe(aujourdhui()), crValide = !!(R && R.valideLe), finJournee = now >= 18 * 60 + 30;
    var corps = '';
    suivrePosition();
    var proche = visiteProche(sans, suivante);
    if (proche) {
      corps += '<div class="bandeau-proche' + classeType(proche.a) + '">' + pastilleType(proche.a, true) + '<p>Vous êtes à <b>' + metres(proche.d) + '</b> de <b>' + esc(nomSansType(proche.a.nom)) + '</b> (prévu à ' + esc(proche.a.heure) + '). Le voir maintenant ?</p>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="procheNon" data-uid="' + proche.a.uid + '">Non</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="procheOui" data-uid="' + proche.a.uid + '">Maintenant</button></div></div>';
    } else {
      var ph = pharmacieProche(duJour);
      if (ph) {
        corps += '<div class="bandeau-proche t-pharma">' + pastilleType(ph.c.prat, true) + '<p><b>' + esc(nomSansType(ph.c.prat.nom)) + '</b> est à <b>' + metres(ph.d) + '</b>' +
          ', ouverte jusqu\'à ' + minutesVersHeure(ph.c.fin) + ' (' + esc(vuDepuis(ph.c.prat.derniere)) + '). Y aller ?</p>' +
          '<div class="rangee"><button class="bouton" type="button" data-a="pharmaNon" data-v="' + esc(ph.c.code) + '">Non</button>' +
          '<button class="bouton bouton-plein" type="button" data-a="pharmaOui" data-v="' + esc(ph.c.cle) + '">Y aller</button></div></div>';
      }
    }
    if (!sans.length) {
      if (!crValide) {
        var msgCloture = finJournee
          ? 'Fin de journée : toutes vos visites sont renseignées. Pensez à finaliser votre compte rendu de la journée.'
          : 'Toutes les visites prévues sont renseignées. Vous pouvez dès maintenant finaliser et envoyer votre compte rendu de la journée.';
        corps += '<p>' + msgCloture + '</p>' +
          '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div>';
      }
      return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
    }
    if (aSaisir.length) {
      corps += '<div class="a-saisir"><b>' + icone('crayon') + aSaisir.length + ' compte' + (aSaisir.length > 1 ? 's' : '') + ' rendu' + (aSaisir.length > 1 ? 's' : '') + ' à saisir</b>' +
        aSaisir.slice(0, 3).map(function (a) { return '<button type="button" class="bouton-texte" data-a="ouvrirVisite" data-uid="' + a.uid + '">' + esc(a.heure) + ' ' + esc(a.nom) + '</button>'; }).join('') + '</div>';
    }
    if (suivante) {
      var pa = praticien(suivante.code) || {}, premiere = suivante === duJour[0] && !duJour.some(function (a) { return a.statut; });
      var cS = coordPrecise(suivante) || coordArret(suivante), pos = S.ui.posGps && Date.now() - S.ui.posGps.t < 5 * 60000 ? S.ui.posGps : null, tr = '';
      if (cS && pos) {
        var qp = Moteur.quartierLePlusProche(pos.lat, pos.lon, quartiers()), dk = distanceVol(pos, cS);
        tr = trajetMini(dk, minutesTrajet(dk, qp ? qp.quartier.commune : '', suivante.commune, now));
      } else if (suivante.dist > 0) tr = trajetMini(suivante.dist, suivante.trajet !== undefined ? suivante.trajet : Math.round(suivante.dist * REGLAGES_MOTEUR.minutesParKm));
      corps += '<div class="suivante"><small>' + (premiere ? 'Première visite' : 'Visite suivante') + '</small><b>' + esc(suivante.heure) + ' · ' + pastilleType(suivante) + esc(suivante.nom) + '</b> ' + etoiles(suivante.note) +
        (lieuQuartier(suivante) ? '<span class="discret bloc-texte">' + esc(lieuQuartier(suivante)) + '</span>' : '') + tr +
        actionsRapides({ telephone: pa.telephone, lat: suivante.lat, lon: suivante.lon, lieu: suivante.lieu, quartier: suivante.quartier, commune: suivante.commune }) +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="ouvrirVisite" data-uid="' + suivante.uid + '">' + icone('crayon') + 'Compte Rendu de cette visite</button></div>';
    }
    if (finJournee && !crValide) {
      corps += '<div class="rappel-cr-soir"><p>Rappel 18 h 30 : pensez à finaliser votre compte rendu de la journée.</p>' +
        '<div class="rangee-wa"><button class="bouton bouton-plein" type="button" data-a="ouvrirRapport">' + icone('valider') + 'Finaliser le compte rendu</button></div></div>';
    }
    return corps ? '<section class="maintenant"><h3>Maintenant</h3>' + corps + '</section>' : '';
  }

  // 3.23.0 : position suivie toutes les 2 minutes pendant que Journée montre aujourd'hui ;
  // une visite prévue plus tard, à moins de 500 m et dont le praticien est présent à cette heure, est proposée « maintenant »
  var RAYON_PROCHE_KM = 0.5, MARGE_PRESENCE_MIN = 10;   // 3.24.20 : 500 m, au moins 10 min de présence restantes
  function suivrePosition() {
    return;   // 3.25.14 : remplacé par le recalcul global (localiser, toutes les PERIODE_GPS_MIN minutes)
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
    // 3.26.10 : la distance se calcule sur toutes les visites où le délégué s'est déplacé (faites ou absent/ko)
    var visitees = duJour.filter(function (a) { return !!a.statut; });
    if (visitees.length) {
      var ordVis = visitees.slice().sort(function (x, y) { return String(heureVisite(x)).localeCompare(String(heureVisite(y))); });
      var tot = 0, prec = departCoord();
      for (var iv = 0; iv < ordVis.length; iv++) {
        var cG = coordPrecise(ordVis[iv]);
        if (cG && prec && typeof distanceVol === 'function') {
          tot += distanceVol(prec, cG);
          prec = cG;
        } else {
          tot += (ordVis[iv].dist || 0);
        }
      }
      s.km = tot > 0 ? (Math.round(tot * 10) / 10) : ordVis.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    } else {
      s.km = duJour.reduce(function (totK, a) { return totK + (a.dist || 0); }, 0);
    }
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
    l.push(['Trajet', km(s.km) + (s.est ? ' (' + minutesVersHeure(s.est.debut) + '–' + minutesVersHeure(s.est.fin) + ')' : '') + (s.communes.length ? ' · ' + s.communes.join(', ') : '')]);
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
          var tousB = (R.besoins || []).length === BESOINS_JOUR.length;
          return '<div class="grille-besoins-cr"><button type="button" class="puce puce-tous" data-a="rapBesoin" data-v="__tous" aria-pressed="' + tousB + '">Tous les besoins</button>' +
            BESOINS_JOUR.map(function (x) { return '<button type="button" class="puce" data-a="rapBesoin" data-v="' + esc(x) + '" aria-pressed="' + ((R.besoins || []).indexOf(x) >= 0) + '">' + esc(x) + '</button>'; }).join('') + '</div>' +
            '<textarea data-f="rapport" data-k="besoinsTexte" placeholder="Précisez si besoin" style="margin-top:8px;min-height:55px">' + esc(R.besoinsTexte || '') + '</textarea>';
        } }
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
      h += '<div class="rangee-actions rangee-actions-cr-valide" style="margin-top:10px">' +
        '<button class="bouton bouton-plein" type="button" data-a="sortirRapport">' + icone('fermer') + '<span>Sortir</span></button>' +
        (page ? '' : '<button class="bouton petit wa" type="button" data-a="rapWhatsapp" data-v="' + d + '">' + icone('whatsapp') + 'Envoyer</button>') +
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
    return ['', '*' + titre + '*' + (l.length > 1 ? ' (' + l.length + ')' : '')].concat(l.length ? l.map(function (x) {
      return (x.indexOf('📍') === 0 || x.indexOf('   •') === 0 || x.indexOf('• ') === 0) ? x : '• ' + x;
    }) : ['_' + vide + '_']);
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

    // 3.25.44 : Regroupement par établissement pour plus de clarté
    var groupes = [], parLieu = {};
    faites.forEach(function (a) {
      var k = String(a.lieu || a.quartier || '').trim() || 'Autre lieu';
      if (!parLieu[k]) {
        parLieu[k] = { lieu: k, commune: a.commune || '', items: [] };
        groupes.push(parLieu[k]);
      }
      var h = heureVisite(a);
      parLieu[k].items.push((h ? h + '  ' : '') + '*' + a.nom + '*' + (a.produits ? ' _(' + a.produits + ')_' : ''));
    });
    var lignesFaites = [];
    groupes.forEach(function (g) {
      if (groupes.length > 1 || g.items.length > 1) {
        lignesFaites.push('📍 *' + g.lieu + '*' + (g.commune && g.lieu.indexOf(g.commune) < 0 ? ' _(' + g.commune + ')_' : ''));
        g.items.forEach(function (it) { lignesFaites.push('   • ' + it); });
      } else {
        lignesFaites.push(g.items[0] + (g.lieu ? ' (' + g.lieu + ')' : ''));
      }
    });
    l = l.concat(sectionWa('Visites faites', lignesFaites));
    l = l.concat(sectionWa('Visites non faites', s.nonFaites.map(function (a) { return a.nom + (a.lieu ? ' (' + a.lieu + ')' : '') + ' : ' + String(statutLibelle(a) || '').toLowerCase(); })));
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
  function barreCriteresPlanifier() {
    var p = S.params, dates = datesAffichees();
    var per;
    if (p.mode === 'jour') {
      per = datePlanLibelle(p.dateRef);
    } else {
      per = 'Sem. ' + datePlanLibelle(dates[0] || p.dateRef);
    }
    var com = p.mode === 'semaine' && p.parJour ? 'Par jour' : libelleCommunes(p.communes);
    var spec = p.typeCibles === 'pharmacies' ? 'Pharmacies' : (p.specialites && p.specialites.length ? (p.specialites.length === coeurDeCible().length && coeurDeCible().every(function (s) { return p.specialites.indexOf(s) >= 0; }) ? 'Cœur (' + p.specialites.length + ')' : p.specialites.length + ' spéc.') : 'Toutes spéc.');
    var rdvN = rdvProchaines(dates).length + S.imposes.length;
    return '<div class="barre-criteres-plan" role="group" aria-label="Critères de la tournée">' +
      '<div class="rangee-criteres rangee-criteres-1">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="quand">' + icone('calendrier') + '<span>' + esc(per) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="ou">' + icone('carte') + '<span>' + esc(com) + '</span></button>' +
      '</div>' +
      '<div class="rangee-criteres rangee-criteres-2">' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="spec">' + icone('filtre') + '<span>' + esc(spec) + '</span></button>' +
        '<button type="button" class="puce petite" data-a="resumeEditer" data-v="rythme"><span>' + p.maxJour + '/j · ' + p.delai + 'j</span></button>' +
        '<button type="button" class="puce petite" data-a="ouvrirRecherche">' + icone('plus') + '<span>' + (rdvN ? rdvN + ' RDV/Prio' : 'RDV / Prio') + '</span></button>' +
      '</div>' +
    '</div>';
  }
  VUES.semaine = function () {
    if (!S.ui.voirParams) importerAgenda();
    if (S.ui.voirParams) {
      return '<div class="page-entree"><button type="button" class="retour" data-a="fermerParams">' + icone('chevron') + 'Planifier</button>' +
        '<h2 class="titre-vue">Planification</h2><p class="sous-titre">Une question à la fois ; touchez un critère pour l\'ajuster ou proposez directement votre tournée.</p>' + rendreParams() + '</div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Planifier</h2>' +
      '<button class="bouton petit bouton-plein" type="button" data-a="voirParams">' + icone('filtre') + 'Critères</button></div>' +
      '<p class="sous-titre">Préparez votre tournée selon vos priorités : ajustez vos critères par secteur et validez votre planning.</p>' +
      barreCriteresPlanifier();
    var datesF = datesPlanAvenir();
    if (!datesF.length) {
      return h + '<div class="vide"><strong>Aucun jour planifié</strong>Touchez « Proposer ma tournée » ou ajustez vos critères ci-dessus.</div>' +
        '<div class="rangee"><button class="bouton bouton-plein bouton-large" type="button" data-a="generer">' + icone('relancer') + 'Proposer ma tournée</button></div>' +
        '<button class="bouton bouton-large" type="button" data-a="voirParams" style="margin-top:8px">' + icone('filtre') + 'Choisir mes critères pas à pas</button>' +
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
    var nMatin = duJour.filter(function (a) { return a.creneau === 'Matin'; }).length;
    var nSoir = duJour.length - nMatin;
    var nPhar = duJour.filter(function (a) { return estPharmacie(a); }).length;
    var nMed = duJour.length - nPhar;
    var totalKm = duJour.reduce(function (s, a) { return s + (a.dist || 0); }, 0);
    var comJour = Array.from(new Set(duJour.map(function (a) { return a.commune; }).filter(Boolean)));
    var etat = jourConfirme(d) ? '<span class="etiquette ok">Confirmé' + (S.jours[d] && S.jours[d].modifieLe ? ', modifié' : '') + '</span>' : '<span class="etiquette alerte">Brouillon</span>';
    var details = [
      nMatin + ' matin' + (nSoir ? ', ' + nSoir + ' soir' : ''),
      (nPhar ? nPhar + ' phcie' + (nPhar > 1 ? 's' : '') : '') + (nPhar && nMed ? ', ' : '') + (nMed ? nMed + ' méd.' : ''),
      n3 ? n3 + ' ★★★' : '',
      km(totalKm)
    ].filter(Boolean).join(' · ');
    h += '<div class="tete-jour-plan"><div class="bilan-jour">' +
      '<div class="bj-ligne1"><b>' + majuscule(dateLongue(d)) + '</b> · ' + duJour.length + ' visite' + (duJour.length > 1 ? 's' : '') +
      (comJour.length ? ' · <span class="bj-communes">' + esc(comJour.join(', ')) + '</span>' : '') + '</div>' +
      '<div class="discret details-plan">' + details + '</div></div>' +
      '<div class="tete-jour-droite">' + etat + '</div></div>';
    h += '<ul class="plan-jour">' + duJour.map(rendreLignePlan).join('') + '</ul>';
    var actionsPlan = '';
    if (enAttente) {
      actionsPlan = '<section class="bandeau-prog accepter"><div><b>Nouvelle sélection</b><span>Conserver ce tirage ?</span></div>' +
        '<div class="rangee"><button class="bouton" type="button" data-a="refuserProgramme" data-v="jour">Refuser</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterJour">' + icone('valider') + 'Accepter</button></div></section>';
    } else if (!jourConfirme(d)) {
      // État B : Jour en brouillon -> Ajouter & Recalculer côte à côte, Accepter centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button></div>' +
        '<div style="text-align:center"><button class="bouton bouton-plein bouton-accepter-plan" type="button" data-a="accepterJour">' + icone('valider') + '<span>Accepter</span></button></div>';
    } else {
      // État C : Jour déjà confirmé -> Ajouter & Recalculer côte à côte, WhatsApp centré en bas
      actionsPlan = '<div class="rangee-tirage"><button class="bouton" type="button" data-a="ajouterTournee">' + icone('plus') + '<span>Ajouter</span></button>' +
        '<button class="bouton" type="button" data-a="tirage" data-v="jour">' + icone('relancer') + '<span>Recalculer</span></button></div>' +
        '<div style="text-align:center"><button class="bouton bouton-plein bouton-accepter-plan wa" type="button" data-a="partagerJourWhatsapp">' + icone('whatsapp') + '<span>WhatsApp</span></button></div>';
    }
    h += '<div class="barre-plan-actions-flottante">' + actionsPlan + '</div>';
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
      '<button class="bouton petit" type="button" data-a="conflitGarder" data-uid="' + a.uid + '">Non</button></div></div>';
  }
  // Candidats pour remplacer une visite : présents ce jour-là, hors tournée, non prévus par un collègue, selon les critères de la tournée ;
  // ceux du même établissement d'abord (+ bonus), ceux qui s'insèrent sans retard, puis par priorité et proximité du lieu remplacé
  function candidatsRemplacement(a) {
    var d = a.date, j = jourSemaineIndex(d), c = ctx(), filtre = filtreCibles(), ex = exclusCollegues([d]);
    var dansPlan = ensemble(S.plan.filter(function (x) { return x.date === d; }).map(function (x) { return x.code; }));
    var origine = coordArret(a), vus = {}, l = [];
    var lieuA = a.lieu || '';
    var cibleEstPh = estPharmacie(a);
    (c.parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      var pEstPh = estPharmacie(p);
      if (pEstPh !== cibleEstPh) return;   // Remplacement strict : médecins par médecins, pharmacies par pharmacies
      if (dansPlan[cr.code] || cr.code === a.code || ex[cr.code] || absentLe(p, d)) return;
      if (!cibleEstPh && filtre && !filtre(p)) return;
      if (d === aujourdhui() && cr.fin <= minutesMaintenant()) return;   // aujourd'hui : seulement ceux encore présents
      if (joursEcoules(p.derniere, d) < (+S.params.delai || 0)) return;
      var dist = origine && cr.coord ? distanceKm(origine, cr.coord) : 99;
      var memeLieu = memeEtablissement(lieuA, cr.lieu);
      var x = { cr: cr, dist: dist, score: Moteur.scoreDe(p, d) + (memeLieu ? 50 : 0), memeLieu: memeLieu };
      var existant = vus[cr.code];
      // 3.26.9 : priorité absolue au créneau du même établissement (CHU, même clinique) si le praticien y exerce aussi
      if (!existant || (x.memeLieu && !existant.memeLieu) || (!existant.memeLieu && x.dist < existant.dist) || (x.memeLieu && existant.memeLieu && x.dist < existant.dist)) {
        vus[cr.code] = x;
      }
    });
    Object.keys(vus).forEach(function (k) { l.push(vus[k]); });
    l.sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.score - 20 * y.dist) - (x.score - 20 * x.dist);
    });
    var jour = S.plan.filter(function (x) { return x.date === d && x.uid !== a.uid; });
    return l.slice(0, 25).map(function (x) {
      var n = Moteur.arretDepuisCreneau(x.cr, d);
      var essai = Moteur.ordonnerJour(jour.map(function (y) { return Object.assign({}, y); }).concat([n]), departCoord());
      var place = essai.filter(function (y) { return y.uid === n.uid; })[0];
      x.heure = place ? place.heure : n.heure; x.ok = !essai.some(function (y) { return y.retard; });
      if (d === aujourdhui() && heureVersMinutes(x.heure) !== null && heureVersMinutes(x.heure) < minutesMaintenant()) x.heure = minutesVersHeure(Math.ceil(minutesMaintenant() / 5) * 5);   // aujourd'hui : au plus tôt maintenant
      return x;
    }).sort(function (x, y) {
      if (y.memeLieu !== x.memeLieu) return y.memeLieu ? 1 : -1;
      return (y.ok ? 1 : 0) - (x.ok ? 1 : 0);
    }).slice(0, 12);
  }
  function remplacerArret(uid) {
    var a = arret(uid); if (!a) return;
    S.ui.feuille = { type: 'remplacer', titre: 'Remplacer ' + a.nom, pleine: true, uid: uid, choix: null, lieuRef: a.lieu };
    rendre();
  }
  function appliquerRemplacement(uid, cle, garder) {
    var a = arret(uid), cr = Moteur.creneauParCle(ctx(), cle); if (!a || !cr) return;
    if (!garder) { S.rejetes[a.code] = true; S.plan = S.plan.filter(function (x) { return x.uid !== uid; }); }
    var n = Moteur.arretDepuisCreneau(cr, a.date); n.etat = 'ajoute'; n.garde = true;
    S.plan.push(n); reordonner(a.date);
    if (S.ui.tab === 'semaine') mettreBrouillon([a.date]);
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
    if (S.ui.tab === 'semaine' && S.plan.some(function (x) { return x.date === a.date; })) mettreBrouillon([a.date]);
    S.ui.ouvert = null; sauver(); rendre(); publierPlan();
    toast(a.nom + ' retiré de la tournée.');
  }
  // 3.26.31 : suppression d'une journée planifiée après confirmation (appui très long sur la date)
  function supprimerJourPlanifie(date) {
    var nb = S.plan.filter(function (x) { return x.date === date; }).length;
    S.plan = S.plan.filter(function (x) { return x.date !== date; });
    delete S.jours[date];
    var rt = LS.get('joursRetires', {});
    rt[date] = true;
    LS.set('joursRetires', rt);
    S.imposes = S.imposes.filter(function (im) { return im.date !== date; });
    var restantes = datesPlanAvenir();
    if (S.ui.jour === date) {
      S.ui.jour = restantes[0] || prochainJourOuvre(ajouterJours(aujourdhui(), 1));
      S.ui.jourVue = null;
    }
    S.ui.ouvert = null;
    marquerModifie();
    sauver();
    rendre();
    publierPlan(true);
    toast('Journée du ' + dateFr(date) + ' supprimée.');
  }
  function demanderSuppressionJour(date, nb) {
    nb = (nb !== undefined && nb !== null) ? nb : S.plan.filter(function (a) { return a.date === date; }).length;
    var dLong = majuscule(dateLongue(date));
    var nStr = nb > 0 ? (nb + ' visite' + (nb > 1 ? 's' : '')) : 'aucune visite';
    confirmerPuis(
      'Supprimer la journée',
      'Voulez-vous supprimer ' + (nb > 0 ? 'toutes les visites prévues le ' : 'la journée du ') + '<b>' + dLong + '</b> (' + nStr + ') ?<br><span class="discret">Cette journée sera retirée de votre planning.</span>',
      'Supprimer la journée',
      function () { supprimerJourPlanifie(date); }
    );
  }
  // Confirmation avant tout changement de la tournée
  // confirme les jours donnés (par défaut le jour affiché), puis propose l'envoi par WhatsApp (Oui / Non / Retour)
  function confirmerProgramme(dates, depuisChoix) {
    dates = dates && dates.length ? dates : [S.ui.jour];
    var avantJours = {};
    dates.forEach(function (d) { avantJours[d] = S.jours[d] ? JSON.parse(JSON.stringify(S.jours[d])) : { etat: 'proposition', valideLe: '', modifieLe: '' }; });
    var avantAAccepter = S.ui.aAccepter;
    confirmerJours(dates); S.ui.aAccepter = null; S.ui.avantTirage = null;
    S.ui.flashTexte = dates.length === 1 ? majuscule(dateLongue(dates[0])) + ' confirmé' : dates.length + ' jours confirmés';
    sauver(); publierPlan(true);
    S.ui.feuille = { type: 'valide', titre: 'Tournée confirmée ✓', dates: dates, avantJours: avantJours, avantAAccepter: avantAAccepter, depuisChoix: !!depuisChoix, retourAction: 'annulerConfirmation' };
    S.ui.flashValide = Date.now() + 4000; setTimeout(function () { S.ui.flashValide = 0; rendreSiPossible(); }, 4100);
    rendre();
  }
  // 3.19.0 : toute question se pose en trois boutons : Oui (appliquer), Non (refuser ; action propre à la question,
  // sinon retour à l'écran), Sortir (fermer sans rien changer et quitter le parcours en cours)
  function confirmerPuis(titre, message, libelleOui, action, siNon, ouiClasse) {
    S.ui.feuille = { type: 'confirmer', titre: titre, message: message, oui: libelleOui || 'Oui', action: action, non: siNon || null, ouiClasse: ouiClasse || null };
    rendre();
  }
  function piedQuestion(ouiAttrs, ouiLib, nonAction, ouiClasse) {
    return '<button class="bouton-texte sortir-question" type="button" data-a="sortirQuestion">Sortir</button>' +
      '<button class="bouton" type="button" data-a="' + (nonAction || 'fermerFeuille') + '">Non</button>' +
      '<button class="bouton ' + (ouiClasse || 'bouton-plein') + '" type="button" ' + ouiAttrs + '>' + ouiLib + '</button>';
  }

  // 3.26.43 : Abréviations conventionnelles et usuelles du secteur médical en Côte d'Ivoire
  // (CHU, CHR, HG, CSU, CSU COM, CMS, CM, GM, Poly., FSU COM, PISAM, SAMU, HMA, ICA).
  // Les noms propres de lieux ou quartiers (ex. Deux Plateaux) et l'identité des cliniques restent strictement intacts.
  function abregerHopital(nom) {
    if (!nom) return '';
    var s = String(nom).trim();

    // 1. Sigles majeurs conventionnels
    s = s.replace(/^Polyclinique\s+Internationale\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^Polyclinique\s+Sainte\s+Anne[- ]Marie\b/i, 'PISAM');
    s = s.replace(/^PISAM\s*\(.*?\)/i, 'PISAM');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\s*\(HMA\)/i, 'HMA');
    s = s.replace(/^H[ôo]pital\s+Militaire\s+d['’]Abidjan\b/i, 'HMA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\s*\(ICA\)/i, 'ICA');
    s = s.replace(/^Institut\s+de\s+Cardiologie\s+d['’]Abidjan\b/i, 'ICA');
    s = s.replace(/^Service\s+d['’]Aide\s+M[ée]dicale\s+Urgente\b/i, 'SAMU');

    // 2. Établissements publics & communautaires
    s = s.replace(/^Centre\s+Hospitalier\s+Universitaire\s+(?:de\s+|d['’])?/i, 'CHU ');
    s = s.replace(/^Centre\s+Hospitalier\s+R[ée]gional\s+(?:de\s+|d['’])?/i, 'CHR ');
    s = s.replace(/^H[ôo]pital\s+G[ée]n[ée]ral\s+(?:de\s+|d['’])?/i, 'HG ');
    s = s.replace(/^(?:Formation\s+Sanitaire\s+Urbaine\s+(?:[àa]\s+base\s+)?Communautaire|FSU[- ]COM)\s+(?:de\s+|d['’])?/i, 'FSU COM ');
    s = s.replace(/^(?:CSU\s+Communautaire|Centre\s+de\s+Sant[ée]\s+Urbain(?:\s+[àa]\s+base)?\s+Communautaire|CSU[- ]COM)\s*(?:de\s+|d['’])?/i, 'CSU COM ');
    s = s.replace(/\bCSU\s+Communautaire\b/gi, 'CSU COM');
    s = s.replace(/\bCSU-COM\b/gi, 'CSU COM');
    s = s.replace(/^Centre\s+de\s+Sant[ée]\s+Urbain\s+(?:de\s+|d['’])?/i, 'CSU ');

    // 3. Établissements privés, cliniques et centres
    s = s.replace(/^Centre\s+M[ée]dico[- ]Social\s+(?:de\s+|d['’])?/i, 'CMS ');
    s = s.replace(/^Centre\s+M[ée]dical\s+(?:de\s+|d['’])?/i, 'CM ');
    s = s.replace(/^Groupe\s+M[ée]dical\s+(?:de\s+|d['’]|du\s+)?/i, 'GM ');
    s = s.replace(/^Polyclinique\s+(?:des\s+|du\s+|de\s+la\s+|de\s+|d['’])?/i, 'Poly. ');
    s = s.replace(/^Clinique\s+M[ée]dicale\s+(?:de\s+|d['’])?/i, 'Clinique ');

    // 4. Voirie et voiries usuelles (Boulevard -> Blvd.)
    s = s.replace(/\bBoulevard\b/gi, 'Blvd.');

    // 5. Préservation et normalisation des quartiers (ex. "2 pltx" -> "Deux Plateaux")
    s = s.replace(/\b2\s*pltx\b/gi, 'Deux Plateaux');
    s = s.replace(/\b2\s*plateaux\b/gi, 'Deux Plateaux');

    return s.replace(/\s{2,}/g, ' ').trim();
  }

  // 3.25.36 : Médecin dans Planifier -> Spécialité, Hôpital où on le voit ce jour (abrégé), Secteur réel et distance
  function infosMedecinPlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var lieuBrut = a.lieu || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lieu) || '';
    var hopital = abregerHopital(lieuBrut);
    var qBrut = a.quartier || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].quartier) || '';
    var comBrut = a.commune || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].commune) || '';
    var coord = a.coord || (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : null);
    var secteur = nomSecteur(qBrut, comBrut, coord);
    var morceaux = [];
    if (a.specialite) morceaux.push(a.specialite);
    if (hopital) morceaux.push(hopital);
    if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) morceaux.push(secteur);
    var pos = S.ui.posGps, c = (pos && Date.now() - pos.t < 15 * 60000) ? (coordPrecise(a) || coordArret(a) || coord) : null;
    if (c && pos) {
      var d = distanceVol(pos, c);
      morceaux.push(distanceCourte(d));
    }
    return morceaux.join(' · ');
  }

  // 3.26.35 : Pharmacie dans Planifier -> Localisation sans doublon + distance GPS en km (identique aux médecins)
  function infosPharmaciePlan(a) {
    var pObj = (typeof praticien === 'function' && praticien(a.code)) || {};
    var pCoord = (pObj.lieux && pObj.lieux[0] && pObj.lieux[0].lat) ? { lat: +pObj.lieux[0].lat, lon: +pObj.lieux[0].lon } : (pObj.lat && pObj.lon ? { lat: +pObj.lat, lon: +pObj.lon } : null);
    var pos = S.ui.posGps, c = (pos && Date.now() - pos.t < 15 * 60000) ? (coordPrecise(a) || coordArret(a) || a.coord || pCoord) : null;
    var base = infosSansDoublon(a, [a.lieu, a.quartier, a.commune]);
    if (c && pos) {
      var d = distanceVol(pos, c);
      return (base ? base + ' · ' : '') + distanceCourte(d);
    }
    return base;
  }

  // Ligne compacte de la tournée (Planifier) : garder, retirer, ouvrir la visite
  function rendreLignePlan(a) {
    var verrou = a.etat === 'valide', e = '';
    if (a.impose) e += '<span class="etiquette p1">' + (a.etape ? esc(libelleRdv(a)) : (a.rdv ? 'RDV ' + esc(a.rdv) : 'Prioritaire')) + '</span>';
    if (a.statut) e += '<span class="etiquette ' + (estKo(a.statut) ? 'ko' : 'ok') + '">' + esc(statutLibelle(a)) + '</span>';
    if (a.retard) e += '<span class="etiquette alerte">Horaire difficile à tenir</span>';
    if (a.fiab !== undefined && a.fiab < 0.6 && a.fiabTexte) e += '<span class="etiquette alerte">Souvent absent ici</span>';
    e += etiquetteCollegues(a.code, a.date);

    // Titre/Nom, Spécialité, Hôpital où on le voit ce jour et Secteur de l'hôpital
    // Pas de localisation précise (quartier précis, distance GPS) : réservée aux pharmacies qui ne bougent pas
    var sousTitre = estPharmacie(a)
      ? infosPharmaciePlan(a)
      : infosMedecinPlan(a);

    return '<li class="ligne-plan' + classeType(a) + (a.garde ? ' gardee' : '') + (verrou ? ' faite' : '') + '">' +
      '<div class="lp-gauche" data-a="voirVisite" data-uid="' + a.uid + '">' +
        '<span class="lp-pastille-col">' + pastilleType(a) + '</span>' +
        '<span class="lp-heure">' + esc(heureVisite(a)) + '</span>' +
      '</div>' +
      '<div class="lp-droite">' +
        '<button type="button" class="lp-corps lp-nom-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
          '<b>' + esc(a.nom) + '</b> ' + etoiles(a.note) +
        '</button>' +
        '<div class="lp-bas">' +
          '<button type="button" class="lp-details-btn" data-a="voirVisite" data-uid="' + a.uid + '">' +
            (sousTitre ? '<span class="discret bloc-texte">' + esc(sousTitre) + '</span>' : '') +
            (e ? '<span class="etiquettes">' + e + '</span>' : '') +
          '</button>' +
          (verrou ? '<span class="lp-fait" title="Compte Rendu enregistré">' + icone('valider') + '</span>' :
            '<span class="lp-actions"><button type="button" class="lp-garder" data-a="garder" data-uid="' + a.uid + '" aria-pressed="' + !!a.garde + '" aria-label="' +
              (a.garde ? 'Ne plus garder' : 'Garder au prochain calcul') + '">' + icone('epingle') + '<small>' + (a.garde ? 'Gardé' : 'Garder') + '</small></button>' +
            '<button type="button" class="lp-retirer" data-a="retirer" data-uid="' + a.uid + '" aria-label="Retirer de la tournée">' + icone('fermer') + '</button></span>') +
        '</div>' +
      '</div>' +
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
  function pucesSpecialitesCible(sel, actToggle, actToutes, actCoeur, actPlus) {
    var coeur = coeurDeCible(), s = sel || [];
    var estCoeur = s.length > 0 && s.length === coeur.length && coeur.every(function (x) { return s.indexOf(x) >= 0; });
    var liste = [], vus = {};
    // 3.25.27 : n'affiche sur la page que le cœur de cible (+ sélectionnées) ; les autres sont dans « Liste complète… »
    coeur.concat(s).forEach(function (nom) {
      if (nom && nom !== 'Pharmacien' && !vus[nom]) { vus[nom] = true; liste.push(nom); }
    });
    return '<div class="puces" style="margin:6px 0 8px">' +
      '<button type="button" class="puce puce-tous" data-a="' + actToutes + '" aria-pressed="' + (!s.length) + '">Toutes</button>' +
      '<button type="button" class="puce" data-a="' + actCoeur + '" aria-pressed="' + estCoeur + '">Cœur de cible (' + coeur.length + ')</button>' +
      '</div>' +
      '<div class="bloc-liste-complete">' +
        '<button type="button" class="bouton bouton-liste-complete" data-a="' + actPlus + '">' + icone('loupe') + 'Liste complète…</button>' +
      '</div>' +
      '<span class="sous-etape" style="margin:6px 0 4px">Spécialités du cœur de cible (pré-sélectionnées, touchez pour modifier)</span>' +
      '<div class="puces">' + liste.map(function (nom) {
        return '<button type="button" class="puce" data-a="' + actToggle + '" data-v="' + esc(nom) + '" aria-pressed="' + (s.indexOf(nom) >= 0) + '">' + esc(nom) + '</button>';
      }).join('') + '</div>';
  }
  function etapesParams() {
    var p = S.params, dates = datesAffichees();
    var demainIso = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
    var l = [
      { id: 'quand', titre: 'Période', resume: function () {
          if (p.mode === 'jour') {
            if (p.dateRef === demainIso || p.dateRef === ajouterJours(aujourdhui(), 1)) return 'Demain';
            if (p.dateRef === aujourdhui()) return 'Aujourd\'hui';
            return 'Journée du ' + dateCourte(p.dateRef);
          }
          return dates.length && dates[0] !== lundiDe(dates[0]) ? 'Du ' + dateCourte(dates[0]) + ' au ' + dateCourte(dates[dates.length - 1]) : 'Semaine du ' + dateCourte(dates[0]);
        },
        rendu: function () {
          var t0 = prochainJourOuvre(aujourdhui()), j1 = prochainJourOuvre(ajouterJours(aujourdhui(), 1));
          var sem0 = lundiDe(t0), sem1 = ajouterJours(lundiDe(aujourdhui()), 7);
          return '<div class="segment" role="group" aria-label="Durée" style="margin-top:8px">' +
              '<button type="button" data-a="param" data-k="mode" data-v="jour" aria-pressed="' + (p.mode === 'jour') + '">Une journée</button>' +
              '<button type="button" data-a="param" data-k="mode" data-v="semaine" aria-pressed="' + (p.mode === 'semaine') + '">Une semaine</button></div>' +
            '<div class="grille-options-2" style="margin-bottom:8px">' +
              (p.mode === 'jour'
                ? '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + t0 + '" aria-pressed="' + (p.dateRef === t0) + '">' + (t0 === aujourdhui() ? 'Aujourd\'hui' : 'Prochain jour ouvré') + '</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="jour" data-d="' + j1 + '" aria-pressed="' + (p.dateRef === j1) + '">Demain</button>'
                : '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem0 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem0) + '">Cette semaine</button>' +
                  '<button type="button" class="puce petite" data-a="paramPeriodeRapide" data-m="semaine" data-d="' + sem1 + '" aria-pressed="' + (lundiDe(p.dateRef) === sem1) + '">Semaine prochaine</button>') +
            '</div>' +
            '<label class="champ" style="margin-bottom:0"><span>' + (p.mode === 'jour' ? 'Date' : 'Semaine du') + '</span>' +
              '<input type="date" data-f="param" data-k="dateRef" min="' + aujourdhui() + '" value="' + esc(p.dateRef) + '"></label>' +
              (p.mode === 'semaine' && lundiDe(p.dateRef) < aujourdhui() ? '<p class="discret" style="margin:6px 0 0">Semaine entamée : seuls les jours à venir seront planifiés.</p>' : '') + bandeauFeries(dates) + bandeauDejaPlanifie(datesPeriode());
        } },
      { id: 'ou', titre: 'Communes ciblées', resume: function () { return p.mode === 'semaine' && p.parJour ? 'Communes différentes selon le jour' : libelleCommunes(p.communes); },
        rendu: function () {
          var h = '<div class="champ" style="margin:8px 0 0"><span>Communes</span>' +
            '<button type="button" class="selecteur" data-a="choisirCommunes" data-v="tout"><span>' + esc(libelleCommunes(p.communes)) + '</span><b>▾</b></button></div>';
          if (p.mode === 'semaine') {
            h += '<label class="interrupteur"><span>Communes différentes selon le jour</span>' +
              '<input type="checkbox" data-f="param" data-k="parJour"' + (p.parJour ? ' checked' : '') + '></label>';
            if (p.parJour) {
              h += '<div class="secteurs">' + JOURS.map(function (j, i) {
                var c = p.communesJour[i];
                return '<div class="secteur"><span>' + j + '</span><button type="button" class="selecteur" data-a="choisirCommunes" data-v="' + i + '"><span>' +
                  esc(c && c.length ? libelleCommunes(c) : 'Comme ci-dessus') + '</span><b>▾</b></button></div>';
              }).join('') + '</div>';
            }
          }
          return h;
        } },
      { id: 'qui', titre: 'Praticiens à visiter', auto: true, resume: function () { return { tous: 'Médecins et pharmacies', medecins: 'Médecins', pharmacies: 'Pharmacies' }[p.typeCibles || 'tous']; },
        rendu: function () {
          return '<div class="grille-options-3" style="margin-top:8px">' + [['medecins', 'Médecins'], ['pharmacies', 'Pharmacies'], ['tous', 'Tous']].map(function (x) {
            return '<button type="button" class="puce" data-a="param" data-k="typeCibles" data-v="' + x[0] + '" data-auto="qui" aria-pressed="' + ((p.typeCibles || 'tous') === x[0]) + '">' + x[1] + '</button>';
          }).join('') + '</div>';
        } },
      { id: 'spec', titre: 'Spécialités', si: p.typeCibles !== 'pharmacies', facultatif: true, resume: function () { return libelleListe(p.specialites, 'Toutes'); },
        rendu: function () {
          return pucesSpecialitesCible(p.specialites, 'paramSpecToggle', 'paramSpecToutes', 'paramSpecDefaut', 'choisirSpecialites') +
            '<p class="discret" style="margin:6px 0 0">' + esc(libelleListe(p.specialites, 'Toutes les spécialités')) + (p.typeCibles === 'tous' ? ' (les pharmacies restent incluses)' : '') + '</p>';
        } },
      { id: 'valeur', titre: 'Potentiel', facultatif: true, resume: function () { return p.potentiels.length ? p.potentiels.map(function (x) { return ETOILES[x]; }).join(' · ') : 'Tous'; },
        rendu: function () {
          var tousP = !p.potentiels.length || p.potentiels.length === 3;
          return '<div class="grille-options-4" style="margin-top:8px">' +
            '<button type="button" class="puce puce-tous" data-a="paramPotentiel" data-v="tous" aria-pressed="' + tousP + '">Tous</button>' +
            ['A', 'B', 'C'].map(function (x) {
              return '<button type="button" class="puce" data-a="paramPotentiel" data-v="' + x + '" aria-pressed="' + (p.potentiels.indexOf(x) >= 0) + '">' + ETOILES[x] + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'rythme', titre: 'Rythme de visite', resume: function () {
          return p.maxJour + '/jour · ' + p.delai + ' j mini' + (!S.config.demo && p.eviterCollegues !== false ? ' · hors collègues' : ''); },
        rendu: function () {
          return '<div class="grille-2 grille-rythme" style="margin-top:8px">' +
              '<div class="champ champ-rythme"><span>Visites par jour</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="1" max="20" inputmode="numeric" data-f="param" data-k="maxJour" value="' + p.maxJour + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="maxJour" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">visites / jour</small></div>' +
              '<div class="champ champ-rythme"><span>Ne pas revoir avant</span>' +
                '<div class="champ-compteur">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="-1" aria-label="Moins">−</button>' +
                  '<input type="number" min="0" max="365" inputmode="numeric" data-f="param" data-k="delai" value="' + p.delai + '">' +
                  '<button type="button" class="btn-pas" data-a="paramPas" data-k="delai" data-pas="1" aria-label="Plus">+</button>' +
                '</div><small class="rythme-unite">jours minimum</small></div></div>' +
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
            var quand = im.force && im.date === aujourdhui()
              ? 'Aujourd\'hui (' + dateCourte(im.date) + ') · visite inopinée'
              : (im.date ? dateFr(im.date) + (c ? ', ' + c.creneau.toLowerCase() + ', ' + esc(c.lieu) : '') : 'Au meilleur moment de la période');
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
    if (enCours) {
      h += '<div style="margin-top:10px;text-align:center"><button type="button" class="bouton-texte" data-a="generer">' + icone('relancer') + 'Proposer directement avec ces critères</button></div>';
      return h + '</section>';
    }
    // toutes les questions sont répondues : on peut proposer
    h += bandeauDejaPlanifie(datesPeriode()) + '<button class="bouton bouton-plein bouton-large" data-a="generer" type="button" style="margin-top:10px">' + icone('relancer') + 'Proposer ma tournée</button>' +
      '</section>';
    return h;
  }

  function rendreProgramme() {
    var h = '';
    // 3.19.0 : le bandeau vert ne s'affiche que quelques secondes après la confirmation
    // 3.25.22 : suppression du bandeau Brouillon en haut d'écran (gain de place mobile ; le badge et les boutons du bas suffisent)
    if (S.ui.flashValide && Date.now() < S.ui.flashValide) {
      h += '<section class="bandeau-prog valide flash"><div><b>Tournée confirmée</b><span>' + esc(S.ui.flashTexte || '') + '. Visible par l\'équipe.</span></div></section>';
    }
    return h;
  }

  // ------------------------------------------------------------------ Compte Rendu de visite (arbre de décision, 3.5.0)
  // Médecin : faite ? → types → produits présentés → réactions → échantillons → bilan → suite (rappel ou RDV confirmé + date)
  // Pharmacie : faite ? → interlocuteur → types → stocks → commande → compléments → suite
  // Non faite : motif → précision → remplaçant → suite. Seul un RDV confirmé place la visite dans la tournée.
  var REACTIONS = ['Intéressé', 'Indécis', 'Non intéressé', 'Non évalué', 'Demande d\'informations'];
  var ETATS_STOCK = ['Disponible', 'Stock faible', 'Rupture', 'Non vérifié'];
  var ANOMALIES = ['Proche péremption', 'Périmé'];
  var INTERLOCUTEURS = ['Pharmacien', 'Vendeurs', 'Chargé Commande', 'Autre'];
  var SUITES = {
    medecin: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['informations', 'Envoyer infos']],
    pharmacie: [['aucune', 'Aucune'], ['visite', 'Nouvelle visite'], ['appeler', 'Appeler'], ['commande', 'Suivi'], ['informations', 'Informations']],
    nonFaite: [['aucune', 'Aucune'], ['reprogrammer', 'Reprogrammer'], ['appeler', 'Appeler']]
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
    var ph = estPharmacie(a);
    if (!a.cr) {
      var c = { types: listeActivites(a.activite), produits: [], produitsStock: [], reactions: {}, echQ: {}, stocks: {}, cmdQ: {}, besoin: [], retourQ: {}, actionProduits: [], suite: 'aucune' };
      if (a.statut) { if (estKo(a.statut)) { c.faite = 'non'; c.motif = a.statut; c.precision = a.commentaire || ''; } else { c.faite = 'oui'; c.bilan = a.commentaire || ''; c.commentaire = a.commentaire || ''; } }
      if (!c.types.length && !a.statut) c.types = derniersTypesCr(ph).slice();
      var lp = listeProduits(a.produits), ref = produitsRef();
      c.produits = lp.filter(function (x) { return ref.indexOf(x) >= 0; }); c.autres = lp.filter(function (x) { return ref.indexOf(x) < 0; }).join(', ');
      if (c.produits.length || c.autres) c.presentes = 'oui';
      else if (!a.statut && !ph) c.produits = derniersProduitsCr().slice();
      if (ph && !a.statut) c.produitsStock = derniersProduitsStockCr().slice();
      if (a.statut && a.prochaine) { c.suite = c.faite === 'non' ? 'reprogrammer' : 'visite'; c.suiteType = 'rdv'; c.date = a.prochaine; }
      else c.suite = 'aucune';
      a.cr = c;
    } else {
      if (!a.cr.suite && a.etat !== 'valide') a.cr.suite = 'aucune';
      if ((!a.cr.types || !a.cr.types.length) && !a.statut && !(a.cr.ok && a.cr.ok.types)) a.cr.types = derniersTypesCr(ph).slice();
      if (ph && !a.cr.produitsStock) a.cr.produitsStock = derniersProduitsStockCr().slice();
    }
    return a.cr;
  }
  function implicite(a, c) {
    var t = c.types || [];
    return estPharmacie(a) ? { stocks: t.indexOf('Stocks') >= 0, commande: t.indexOf('Commande') >= 0 }
      : { presentes: (t.indexOf('Présentation') >= 0 || t.indexOf('Présentation produit') >= 0), echant: t.indexOf('Échantillons') >= 0 };
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
          var prodsK = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : Object.keys(c.stocks || {});
          r.stocks = prodsK.filter(function (p) { return c.stocks[p] && c.stocks[p].etat; }).map(function (p) {
            var s = c.stocks[p]; return p + ' : ' + s.etat.toLowerCase() + (s.qte ? ' (' + s.qte + ')' : '') + (s.anomalie ? ', ' + s.anomalie.toLowerCase() + (s.lot ? ' lot ' + s.lot : '') : '');
          }).concat(c.autresStock ? ['Autres : ' + c.autresStock] : []).join(' ; ');
          r.produits = prodsK.filter(function (p) { return c.stocks[p] && (c.stocks[p].etat === 'Disponible' || c.stocks[p].etat === 'En stock' || c.stocks[p].etat === 'Stock faible'); }).join(', ');
          if (!r.produits && c.produitsStock && c.produitsStock.length) r.produits = c.produitsStock.join(', ');
        }
        if (c.commande === 'oui' || im.commande) r.commande = listeQ(c.cmdQ) || 'Oui';
        else if (c.commande === 'non' && ((c.besoin || []).length || c.besoinTexte)) r.commande = 'Besoin : ' + (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []).join(', ');
        var t = c.types || [], comp = [];
        if (t.indexOf('Échantillons') >= 0 && listeQ(c.echQ)) { comp.push('Échantillons : ' + listeQ(c.echQ)); r.echantillons = listeQ(c.echQ); }
        if ((t.indexOf('Retour ou échange') >= 0 || t.indexOf('Retour') >= 0) && (listeQ(c.retourQ) || c.retourMotif)) comp.push('Retour : ' + listeQ(c.retourQ) + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''));
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
  function choixCr(a, cle, options, val, classePuces) {
    var o = optionsNorm(options);
    if (o.length === 2) return '<div class="segment" role="group" style="margin:8px 0 0">' + o.map(function (x) {
      return '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="' + cle + '" data-v="' + esc(x[0]) + '" aria-pressed="' + (val === x[0]) + '">' + esc(x[1]) + '</button>';
    }).join('') + '</div>';
    if (o.length > 5 && cle !== 'motif') return selecteurCr(a, cle, o, val ? [val] : [], false, 'Choisir…');
    return '<div class="puces' + (classePuces ? ' ' + classePuces : '') + '">' + o.map(function (x) { return puceCr(a, cle, x[0], x[1], val === x[0]); }).join('') + '</div>';
  }
  function multiCr(a, cle, options, vals) {
    if (options.length > 4) return selecteurCr(a, cle, options, vals || [], true, 'Choisir');
    var v = vals || [], tous = options.length > 1 && v.length === options.length;
    return '<div class="puces">' +
      (options.length > 1 ? '<button type="button" class="puce puce-tous" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="' + cle + '" aria-pressed="' + tous + '">Tous</button>' : '') +
      options.map(function (o) { return puceCr(a, cle, o, o, v.indexOf(o) >= 0, true); }).join('') + '</div>';
  }
  // 3.25.27 : Parcours et types de visite strictement différenciés Médecin vs Pharmacie (sans mention croisée)
  function rendreChoixTypesCr(a, vals) {
    var ph = estPharmacie(a), sel = vals || [];
    var list = ph ? activitesPharmacie() : activites();
    S.ui.crOptions[a.uid + '|types'] = optionsNorm(list);
    var toutCoche = list.length > 0 && list.every(function (t) { return sel.indexOf(t) >= 0; });
    var h = '<div class="gammes-cr">';
    h += '<div class="gamme-cr-actions"><span class="discret">' + (sel.length ? sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + ' : ' + esc(sel.join(', ')) : (ph ? 'Choisissez au moins une activité' : 'Choisissez au moins un type')) + '</span>' +
      '<span><button type="button" class="lien-action" data-a="crMultiTous" data-uid="' + a.uid + '" data-k="types">' + (toutCoche ? 'Tout décocher' : 'Tous') + '</button>' +
      (sel.length ? ' · <button type="button" class="lien-action" data-a="crTypesAucun" data-uid="' + a.uid + '">Effacer</button>' : '') + '</span></div>';
    h += '<div class="gamme-cr-bloc"><div class="gamme-cr-titre"><span><b>' + (ph ? 'Activités en pharmacie' : 'Types de visite médicale') + '</b></span></div>' +
      '<div class="puces puces-types-cr">' + list.map(function (t) {
        var libT = (t === 'Présentation produit' || t === 'Présentation') ? 'Présentation'
                 : (t === 'Retour ou échange' || t === 'Retour') ? 'Retour'
                 : t;
        return puceCr(a, 'types', t, libT, sel.indexOf(t) >= 0, true);
      }).join('') + '</div></div>';
    h += '</div>';
    return h;
  }
  // 3.25.36 : Présentation 2x2 harmonieuse des produits par gamme selon la taille
  function libellePastilleCr(nomGamme, prod, totalFiches) {
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var p = String(prod || '').trim();
    if (p === nom) return nom;
    if (p.indexOf(nom + ' ') === 0) {
      var court = p.slice(nom.length + 1);
      if (/^\d+$/.test(court)) court += ' mg';
      return court;
    }
    if (totalFiches === 1) return p;
    return p;
  }
  function taillePastille(court) {
    var len = (court || '').length;
    if (len <= 4) return 'court';
    if (len <= 7) return 'moyen';
    return 'long';
  }
  function harmoniserDeclinaisons(fiches, nomGamme) {
    if (!fiches || fiches.length <= 2) return fiches || [];
    var nom = String(nomGamme || '').replace(/\s*\(.*\)$/, '').trim();
    var items = fiches.map(function (f) {
      var c = libellePastilleCr(nom, f.produit, fiches.length);
      var estBase = (f.produit === nom);
      return { f: f, court: c, len: c.length, estBase: estBase };
    });
    // Pour 4 déclinaisons (ex: Zyltan : Zyltan, H, AM, Losartan AM)
    if (items.length === 4) {
      var baseIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (items[i].estBase) { baseIdx = i; break; }
      }
      if (baseIdx >= 0) {
        var baseItem = items.splice(baseIdx, 1)[0];
        items.sort(function (a, b) { return a.len - b.len; });
        return [baseItem.f, items[0].f, items[1].f, items[2].f];
      }
      items.sort(function (a, b) { return a.len - b.len; });
      return [items[0].f, items[1].f, items[2].f, items[3].f];
    }
    items.sort(function (a, b) {
      if (a.estBase !== b.estBase) return a.estBase ? -1 : 1;
      return a.len - b.len;
    });
    return items.map(function (x) { return x.f; });
  }

  function rendreChoixProduitsCr(a, cle, vals) {
    var inactifs = {};
    var lFiches = (S.data && S.data.fiches) || [];
    lFiches.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });

    var brut = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    brut = brut.filter(function (p) { return !inactifs[normaliser(p)]; });
    var autorises = {};
    brut.forEach(function (p) { autorises[normaliser(p)] = true; });

    var fichesToutes = (typeof fichesProduits === 'function' ? fichesProduits() : FICHES_PRODUITS_DEFAUT) || [];
    // 3.25.40 : Seuls les produits listés dans Listes!K sont affichés dans le CR visite
    var fiches = fichesToutes.filter(function (f) { return autorises[normaliser(f.produit)] && !inactifs[normaliser(f.produit)]; });
    if (!fiches.length) fiches = fichesToutes.filter(function (f) { return !inactifs[normaliser(f.produit)]; });
    var gammes = typeof gammesProduits === 'function' ? gammesProduits(fiches) : [];
    var sel = vals || [];

    // Séparation stricte Gamme A vs Gamme B
    var famsA = gammes.filter(function (g) { return estGammeA('', g.nom); });
    var famsB = gammes.filter(function (g) { return !estGammeA('', g.nom); });

    var prodsA = [], prodsB = [];
    famsA.forEach(function (g) { g.fiches.forEach(function (f) { prodsA.push(f.produit); }); });
    famsB.forEach(function (g) { g.fiches.forEach(function (f) { prodsB.push(f.produit); }); });

    var nbSelA = prodsA.filter(function (p) { return sel.indexOf(p) >= 0; }).length;
    var nbSelB = prodsB.filter(function (p) { return sel.indexOf(p) >= 0; }).length;

    // 3.25.37 : Gamme A toujours visible directement ; seule la Gamme B est repliée par défaut sur une seule ligne
    var bOuvert = !!S.ui.gammeBOuverte;
    var tousA = prodsA.length > 0 && prodsA.every(function (p) { return sel.indexOf(p) >= 0; });
    var tousB = prodsB.length > 0 && prodsB.every(function (p) { return sel.indexOf(p) >= 0; });

    var h = '<div class="choix-produits-cr">';
    h += '<div class="gamme-cr-actions" style="margin-bottom:8px">' +
      '<span class="discret">' + (sel.length ? '<b>' + sel.length + ' sélectionné' + (sel.length > 1 ? 's' : '') + '</b> : ' + esc(sel.join(', ')) : 'Touchez un produit pour le sélectionner') + '</span>' +
      (sel.length ? '<span><button type="button" class="lien-action" data-a="crProduitsAucun" data-uid="' + a.uid + '" data-k="' + cle + '">Tout effacer</button></span>' : '') +
      '</div>';

    // 1) Gamme A : directement affichée, entête compacte sans repli
    h += '<div class="gamme-cr-bloc ouverte" style="margin-bottom:6px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<span><b>Gamme A</b>' + (nbSelA ? ' <i class="compteur">' + nbSelA + '</i>' : '') + '</span>' +
        (prodsA.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="A">' + (tousA ? 'Tout décocher' : 'Tous') + '</button>' : '') +
      '</div>' +
      '<div class="liste-gammes-cr">';
    famsA.forEach(function (g) {
      var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
      var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
      var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
      var seul = fichesTriees.length === 1;

      h += '<div class="ligne-gamme">' +
        '<div class="lg-tete">' +
          '<b>' + esc(nom) + '</b>' +
        '</div>' +
        '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
        fichesTriees.map(function (f) {
          var court = libellePastilleCr(nom, f.produit, g.fiches.length);
          var estSel = sel.indexOf(f.produit) >= 0;
          var tClass = taillePastille(court);
          return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
        }).join('') +
        '</div></div>';
    });
    h += '</div></div>';

    // 2) Gamme B : seule à être fermée par défaut, compacte sur la même ligne (gain d'espace)
    h += '<div class="gamme-cr-bloc' + (bOuvert ? ' ouverte' : ' repliee') + '" style="margin-bottom:8px">' +
      '<div class="gamme-cr-entete gamme-compacte">' +
        '<button type="button" class="gamme-cr-bascule" data-a="crGammeBascule" data-g="B" aria-expanded="' + bOuvert + '">' +
          '<span><b>Gamme B</b></span>' +
          '<span class="gamme-cr-meta">' + (nbSelB ? '<i class="compteur">' + nbSelB + '</i>' : '<small>' + famsB.length + ' fam.</small>') + icone('chevron') + '</span>' +
        '</button>' +
        (bOuvert && prodsB.length > 1 ? '<button type="button" class="lien-action" data-a="crGammeTous" data-uid="' + a.uid + '" data-k="' + cle + '" data-g="B">' + (tousB ? 'Décocher B' : 'Tous') + '</button>' : '') +
      '</div>';

    if (bOuvert) {
      h += '<div class="liste-gammes-cr">';
      famsB.forEach(function (g) {
        var nom = String(g.nom || '').replace(/\s*\(.*\)$/, '').trim();
        var mol = (String(g.nom || '').match(/\(([^)]+)\)/) || [])[1] || '';
        var fichesTriees = harmoniserDeclinaisons(g.fiches, nom);
        var seul = fichesTriees.length === 1;

        h += '<div class="ligne-gamme">' +
          '<div class="lg-tete">' +
            '<b>' + esc(nom) + '</b>' +
          '</div>' +
          '<div class="lg-produits' + (seul ? ' seul' : '') + '">' +
          fichesTriees.map(function (f) {
            var court = libellePastilleCr(nom, f.produit, g.fiches.length);
            var estSel = sel.indexOf(f.produit) >= 0;
            var tClass = taillePastille(court);
            return '<button type="button" class="pastille-produit ' + tClass + '" data-a="crMulti" data-uid="' + a.uid + '" data-k="' + esc(cle) + '" data-v="' + esc(f.produit) + '" aria-pressed="' + estSel + '" aria-label="' + esc(f.produit) + '">' + esc(court) + '</button>';
          }).join('') +
          '</div></div>';
      });
      h += '</div>';
    }
    h += '</div>';

    h += '</div>';
    return h;
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
  function pucesValCr(a, cle, options, val, libs, classe) {
    return '<div class="puces' + (classe ? ' ' + classe : '') + '">' + options.map(function (o) {
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
      e('precision', 'Précision', 'facultatif', function () { return texteCr(a, 'precision', c.precision, ph ? 'Ex. pharmacien en congé' : 'Ex. en bloc opératoire', true); },
        function () { return c.precision || 'aucune'; });
      e('remplacant', 'Remplacer à proximité ?', 'auto', function () {
        return '<div class="segment" role="group" style="margin:8px 0 0">' +
          '<button type="button" data-a="crActionRemplacer" data-uid="' + a.uid + '">' + icone('carte') + ' Remplacer</button>' +
          '<button type="button" data-a="crChoix" data-uid="' + a.uid + '" data-k="remplacant" data-v="non" aria-pressed="' + (c.remplacant === 'non') + '">Non</button>' +
          '</div>';
      }, function () { return c.remplacant === 'oui' ? 'Remplacer' : (c.remplacant === 'non' ? 'Non' : ''); });
      if (c.remplacant === 'oui') { l.push({ id: '__remplacer', fin: 'remplacer' }); return l; }
      etapesSuite(a, c, SUITES.nonFaite, e);
      return l;
    }
    if (!ph) {
      e('types', 'Type(s) de visite médicale', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
        function () { return (c.types || []).length ? '' : 'choisissez au moins un type de visite médicale'; });
      if (!im.presentes) e('presentes', 'Produits présentés ?', 'auto', function () { return choixCr(a, 'presentes', [['oui', 'Oui'], ['non', 'Non']], c.presentes); }, function () { return oui(c.presentes); });
      if (c.presentes === 'oui' || im.presentes) {
        e('produits', 'Produits présentés', 'continuer', function () {
          return rendreChoixProduitsCr(a, 'produits', c.produits);
        }, function () { return produitsPresentes(c).join(', '); }, function () { return produitsPresentes(c).length ? '' : 'choisissez au moins un produit'; });
        e('reactions', 'Réaction du médecin', 'continuer', function () {
          return '<div class="champs-cr">' + produitsPresentes(c).map(function (p) {
            return '<div class="champ champ-reaction-produit"><div class="etiquette-med-cr"><b>' + esc(p) + '</b></div><div class="grille-reactions-cr">' + pucesValCr(a, 'reactions.' + p, REACTIONS, c.reactions[p]) + '</div></div>';
          }).join('') + '</div>';
        }, function () { var r = produitsPresentes(c).filter(function (p) { return c.reactions[p]; }); return r.length ? r.map(function (p) { return p + ' : ' + c.reactions[p].toLowerCase(); }).join(', ') : 'non renseignée'; });
      }
      if (!im.echant) e('echant', 'Échantillons remis ?', 'auto', function () { return choixCr(a, 'echant', [['oui', 'Oui'], ['non', 'Non']], c.echant); }, function () { return oui(c.echant); });
      if (c.echant === 'oui' || im.echant) e('echQ', 'Échantillons remis (quantités)', 'continuer', function () { return tableQ(a, 'echQ', produitsPresentes(c), c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
      e('bilan', 'Bilan', 'facultatif', function () { return texteCr(a, 'bilan', c.bilan, 'Besoins, objections, engagements, autres activités…', true); }, function () { return c.bilan || 'aucun'; });
      etapesSuite(a, c, SUITES.medecin, e);
      return l;
    }
    e('interlocuteur', 'Interlocuteur', 'auto', function () { return choixCr(a, 'interlocuteur', INTERLOCUTEURS, c.interlocuteur); }, function () { return c.interlocuteur; });
    e('types', 'Activité(s) en pharmacie', 'continuer', function () { return rendreChoixTypesCr(a, c.types); }, function () { return (c.types || []).join(', '); },
      function () { return (c.types || []).length ? '' : 'choisissez au moins une activité en pharmacie'; });
    if (!im.stocks) e('stocksVerif', 'Stocks vérifiés ?', 'auto', function () { return choixCr(a, 'stocksVerif', [['oui', 'Oui'], ['non', 'Non']], c.stocksVerif); }, function () { return oui(c.stocksVerif); });
    if (c.stocksVerif === 'oui' || im.stocks) {
      e('produitsStock', 'Produits vérifiés en stock', 'continuer', function () {
        return rendreChoixProduitsCr(a, 'produitsStock', c.produitsStock || []);
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.join(', ') || 'aucun';
      }, function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        return prods.length ? '' : 'sélectionnez au moins un produit à vérifier';
      });
      e('stocks', 'Stock par produit', 'continuer', function () {
        var prods = (c.produitsStock && c.produitsStock.length) ? c.produitsStock : [];
        if (!prods.length) return '<p class="discret">Aucun produit sélectionné à l\'étape précédente.</p>';
        return '<div class="champs-cr">' + prods.map(function (p) {
          var s = c.stocks[p] || {};
          return '<div class="ligne-stock"><b>' + esc(p) + '</b><div class="champ"><span>État</span>' + pucesValCr(a, 'stocks.' + p + '.etat', ETATS_STOCK, s.etat, null, 'puces-etats-stock') + '</div>' +
            '<label class="champ"><span>Quantité</span>' + qteCr(a, 'stocks.' + p + '.qte', s.qte) + '</label>' +
            (s.etat === 'Disponible' || s.etat === 'En stock' || s.etat === 'Stock faible' ? '<div class="champ"><span>Anomalie</span>' + pucesValCr(a, 'stocks.' + p + '.anomalie', [''].concat(ANOMALIES), s.anomalie || '', { '': 'Aucune' }) + '</div>' +
              (s.anomalie ? '<label class="champ"><span>N° de lot</span><input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="stocks.' + p + '.lot" value="' + esc(s.lot || '') + '" placeholder="N° de lot"></label>' : '') : '') + '</div>';
        }).join('') + '</div>' + texteCr(a, 'autresStock', c.autresStock, 'Autres produits et état, ex. Doliprane rupture');
      }, function () { var r = champsCr(a).stocks; return r || 'aucun produit renseigné'; });
    }
    if (!im.commande) e('commande', 'Commande passée ?', 'auto', function () { return choixCr(a, 'commande', [['oui', 'Oui'], ['non', 'Non']], c.commande); }, function () { return oui(c.commande); });
    if (c.commande === 'non') e('besoin', 'Besoin de réapprovisionnement', 'facultatif', function () { return rendreChoixProduitsCr(a, 'besoin', c.besoin) + texteCr(a, 'besoinTexte', c.besoinTexte, 'Autres besoins'); },
      function () { var b = (c.besoin || []).concat(c.besoinTexte ? [c.besoinTexte] : []); return b.length ? b.join(', ') : 'aucun'; });
    var t = c.types || [];
    if (t.indexOf('Échantillons') >= 0) e('echQ', 'Échantillons (quantités)', 'continuer', function () { return tableQ(a, 'echQ', cat, c.echQ); }, function () { return listeQ(c.echQ) || 'aucune quantité'; });
    if (t.indexOf('Retour') >= 0 || t.indexOf('Retour ou échange') >= 0) e('retour', 'Retour', 'continuer', function () { return tableQ(a, 'retourQ', cat, c.retourQ) + texteCr(a, 'retourMotif', c.retourMotif, 'Motif du retour'); },
      function () { return (listeQ(c.retourQ) || 'aucune quantité') + (c.retourMotif ? ' (' + c.retourMotif + ')' : ''); });
    var act = t.filter(function (x) { return ['PLV', 'Formation', 'Animation'].indexOf(x) >= 0; });
    if (act.length) e('action', act.join(', ') + ' : action et produits', 'continuer', function () { return texteCr(a, 'action', c.action, 'Ex. présentoir installé, équipe formée sur Rozukaa') + rendreChoixProduitsCr(a, 'actionProduits', c.actionProduits); },
      function () { return [c.action].concat(c.actionProduits || []).filter(Boolean).join(', ') || 'non précisé'; });
    e('commentaire', 'Commentaire', 'facultatif', function () { return texteCr(a, 'commentaire', c.commentaire, 'Demande du pharmacien, concurrence, prix…', true); }, function () { return c.commentaire || 'aucun'; });
    etapesSuite(a, c, SUITES.pharmacie, e);
    return l;
  }
  function etapesSuite(a, c, options, e) {
    var valSuite = c.suite || 'aucune';
    var lib = function (v) { return ((options.filter(function (o) { return o[0] === v; })[0]) || [])[1] || 'Aucune'; };
    e('suite', 'Étape suivante', 'auto', function () {
      return choixCr(a, 'suite', options, valSuite, 'puces-suite-cr') +
        (valSuite === 'aucune' ? '<div class="rangee cr-boutons" style="margin-top:10px"><button class="bouton bouton-plein" type="button" data-a="crOk" data-uid="' + a.uid + '" data-v="suite">Terminer</button></div>' : '');
    }, function () { return lib(valSuite); });
    if (!c.suite || c.suite === 'aucune') return;
    e('suiteType', 'Rappel ou RDV confirmé ?', 'auto', function () { return choixCr(a, 'suiteType', [['rappel', 'Rappel'], ['rdv', 'RDV confirmé']], c.suiteType); },
      function () { return c.suiteType === 'rdv' ? 'RDV confirmé' : 'Rappel'; });
    e('date', 'Prochaine étape le', 'auto', function () {
      return '<div class="rangee-prochaine">' + [1, 7, 14, 30].map(function (n) {
        var d = ajouterJours(a.date, n);
        var lib = n === 1 ? '+1 j' : '+' + n + ' j';
        var sous = n === 1 ? 'Demain' : (n === 7 ? '1 sem.' : (n === 14 ? '2 sem.' : '1 mois'));
        return '<button type="button" class="puce puce-prochaine" data-a="crDate" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + (c.date === d) + '">' +
          '<b>' + lib + '</b><small>' + sous + '</small></button>';
      }).join('') + '</div><label class="champ" style="margin:10px 0 0"><span>Ou une date précise</span><input type="date" data-f="crSelect" data-uid="' + a.uid + '" data-k="date" value="' + esc(c.date || '') + '" aria-label="Date de la prochaine étape"></label>' +
        '<span class="aide-champ">' + (c.suiteType === 'rappel' ? 'Rappel : il s\'affiche ce jour-là dans « Journée », sans modifier la tournée.' :
          'RDV confirmé : ' + (estPharmacie(a) ? 'la pharmacie est placée' : 'le praticien est placé') + ' d\'office ce jour-là dans vos tournées.') + '</span>';
    }, function () { return c.date ? majuscule(dateLongue(c.date)) : ''; });
  }
  // libellés courts des réponses repliées (comme Planifier : « Période  Journée du… »)
  var TITRES_COURTS = { 'Type(s) de visite médicale': 'Types', 'Activité(s) en pharmacie': 'Activités', 'La visite a-t-elle été faite ?': 'Visite faite', 'Trouver un remplaçant à proximité ?': 'Remplaçant', 'Type(s) de visite': 'Types',
    'Activité(s)': 'Types', 'Produits présentés ?': 'Présentés', 'Produits présentés': 'Produits', 'Réaction du médecin': 'Réaction',
    'Échantillons remis ?': 'Échantillons', 'Échantillons remis (quantités)': 'Échantillons', 'Échantillons (quantités)': 'Échantillons',
    'Étape suivante': 'Suite', 'Rappel ou RDV confirmé ?': 'Rappel / RDV', 'Prochaine étape le': 'Date', 'Stocks vérifiés ?': 'Stocks', 'Stock par produit': 'Détails stock',
    'Produits vérifiés en stock': 'Produits', 'Retour': 'Retour', 'Retour ou échange': 'Retour',
    'Commande passée ?': 'Commande', 'Commande (quantités)': 'Quantités', 'Besoin de réapprovisionnement': 'Besoin' };
  function titreCourt(t) { return TITRES_COURTS[t] || t; }
  // 3.25.43 : Formulaire Express en un seul écran pour les visites rapides
  function rendreCompteRenduExpress(a) {
    var c = crDe(a);
    if (!c.statut) { c.statut = 'Visite faite'; syncCr(a); }
    var estFait = Moteur.estVisite(c.statut, statuts());
    var ph = estPharmacie(a);

    var h = '<div class="cr-express-bloc">' +
      '<div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center">' +
      '<div><h3 style="margin:0;display:inline-block">Compte Rendu Express</h3> <span class="pastille-version" style="font-size:11px;background:var(--bleu-pale);color:var(--primaire);padding:2px 6px;border-radius:4px;font-weight:700">1 écran</span></div>' +
      '<button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '" style="font-size:12px;padding:2px 0">Formulaire complet →</button>' +
      '</div>';

    // 1. Statut
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Statut de la visite</span>' +
      '<div class="puces" style="margin-top:4px">' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Visite faite" aria-pressed="' + (c.statut === 'Visite faite') + '">✓ Visite faite</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Absent" aria-pressed="' + (c.statut === 'Absent') + '">Absent</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="Indisponible" aria-pressed="' + (c.statut === 'Indisponible') + '">Indisponible</button>' +
      '<button type="button" class="puce" data-a="crStatutExpress" data-uid="' + a.uid + '" data-v="RDV reporté" aria-pressed="' + (c.statut === 'RDV reporté') + '">Reporté</button>' +
      '</div></div>';

    if (!estFait) {
      h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
        '<span>Préciser le motif</span>' +
        '<select data-f="crSelect" data-uid="' + a.uid + '" data-k="statut">' +
        statuts().filter(function (s) { return !s.visite; }).map(function (s) {
          return '<option' + (s.nom === c.statut ? ' selected' : '') + '>' + esc(s.nom) + '</option>';
        }).join('') + '</select></div>';
      h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:8px">' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer la visite non réalisée</button>' +
        (a.hors ? '' : '<button class="bouton bouton-large" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' + icone('cible') + 'Enregistrer et remplacer dans la tournée</button>') +
        '</div>';
      return h + '</div>';
    }

    // 2. Types de visite / Activités
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      rendreChoixTypesCr(a, c.types) +
      '</div>';

    // 3. Produits présentés
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<div class="gamme-cr-titre" style="margin-bottom:6px"><span><b>Produits présentés</b></span></div>' +
      rendreChoixProduitsCr(a, 'produits', c.produits) +
      '</div>';

    // 4. Prochaine étape
    var optProchaine = [
      ['', 'Aucune'],
      ['+1', 'Demain'],
      ['+7', '+7 j'],
      ['+14', '+14 j'],
      ['+30', '+30 j']
    ];
    var valP = c.prochaine;

    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Prochain contact / RDV</span>' +
      '<div class="puces" style="margin-top:4px">' +
      optProchaine.map(function (op) {
        var d = op[0] ? ajouterJours(aujourdhui(), parseInt(op[0], 10)) : '';
        var actif = (op[0] === '' && !valP) || (op[0] && valP === d);
        return '<button type="button" class="puce" data-a="crEtapeRapide" data-uid="' + a.uid + '" data-v="' + d + '" aria-pressed="' + actif + '">' + op[1] + '</button>';
      }).join('') +
      '</div></div>';

    // 5. Bilan / Note rapide facultative
    h += '<div class="champ etape-cr-bloc" style="margin-top:10px">' +
      '<span>Observation rapide <small class="discret">(facultatif)</small></span>' +
      '<input type="text" data-f="cr" data-uid="' + a.uid + '" data-k="bilan" value="' + esc(c.bilan || '') + '" placeholder="Objections, engagements, besoins…">' +
      '</div>';

    // 6. Bouton de validation sous le pouce
    h += '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">' +
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>' +
      '<div style="text-align:center"><button type="button" class="bouton-texte" data-a="basculerModeComplet" data-uid="' + a.uid + '">Formulaire complet</button></div>' +
      '</div>';

    return h + '</div>';
  }

  function rendreCompteRendu(a) {
    if (S.config.crExpress && !a.modeComplet) {
      return rendreCompteRenduExpress(a);
    }
    var c = crDe(a), ok = c.ok || (c.ok = {}), h = '<div class="cr-pas etapes-filtres"><div class="tete-bloc tete-cr" style="display:flex;justify-content:space-between;align-items:center"><h3>Compte Rendu</h3>' +
      (S.config.crExpress ? '<button type="button" class="bouton-texte" data-a="basculerModeExpress" data-uid="' + a.uid + '" style="font-size:12px">⚡ Mode express</button>' : '') +
      '</div>';
    var etapes = etapesCr(a);
    for (var i = 0; i < etapes.length; i++) {
      var s = etapes[i];
      if (s.fin === 'remplacer') {
        return h + '<div class="actions-cr"><button class="bouton bouton-plein" type="button" data-a="crRemplacer" data-uid="' + a.uid + '">' +
          icone('cible') + 'Remplacer</button></div></div>';
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

  // 3.25.15 / 3.25.47 : compte rendu : après chaque réponse, la question suivante (ou le choix touché) reste au milieu de l'écran visible
  function centrerQuestion(uid) {
    setTimeout(function () {
      var c = document.querySelector('.arret.ouvert .cr-question') ||
              document.querySelector('.arret.ouvert .cr-express-bloc') ||
              document.querySelector('.arret.ouvert .actions-cr') ||
              document.querySelector('.arret.ouvert .rangee-actions-cr-valide') ||
              document.querySelector('.arret.ouvert');
      if (c) centrerElement(c);
    }, 40);
  }
  function centrerQuestionRapport() {
    setTimeout(function () {
      var q = document.querySelector('.rapport-jour .cr-question') ||
              document.querySelector('.rapport-jour [data-a="rapValider"]') ||
              document.querySelector('.rapport-jour .rangee-actions-cr-valide') ||
              document.querySelector('.rapport-jour');
      if (q) centrerElement(q, false);
    }, 50);
  }
  function centrerChoix(el) {
    setTimeout(function () {
      var sel = '[data-a="' + el.dataset.a + '"][data-uid="' + el.dataset.uid + '"][data-k="' + (el.dataset.k || '') + '"][data-v="' + (el.dataset.v || '') + '"]';
      var b = null; try { b = document.querySelector(sel); } catch (e) {}
      var c = b || document.querySelector('.arret.ouvert .cr-question') || document.querySelector('.arret.ouvert');
      if (c) centrerElement(c);
    }, 40);
  }
  function boutonEnregistrer(a) {
    var m = manquesCr(a);
    return '<div class="actions-cr">' + (m.length ?
      '<button class="bouton" type="button" disabled>' + icone('valider') + 'Enregistrer</button><span class="aide-champ">Pour enregistrer : ' + esc(m.join(', ')) + '.</span>' :
      '<button class="bouton bouton-plein" type="button" data-a="validerUn" data-uid="' + a.uid + '">' + icone('valider') + 'Enregistrer</button>') + '</div>';
  }
  // une valeur par ligne : « Routine, Présentation produit » ou « A ; B » s'affichent l'un sous l'autre
  function parLigne(v) { return String(v || '').split(/\s*;\s*|\n+/).filter(Boolean).map(esc).join('<br>'); }
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
      var prodsK = (cs.produitsStock && cs.produitsStock.length) ? cs.produitsStock : Object.keys(st);
      cartesStock = prodsK.filter(function (p) { return st[p] && st[p].etat; }).map(function (p) {
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
    if (cle === 'types') memoriserDerniersTypesCr(estPharmacie(a), c.types);
    if (cle === 'produits' && !estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
    if (cle === 'produitsStock') memoriserDerniersProduitsStockCr(c.produitsStock);
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
  // 3.25.36 : distance entre moi (GPS) et une visite du jour pas encore faite avec durées à pied et en voiture
  function distanceMoi(a) {
    var pos = S.ui.posGps, cp = pos && Date.now() - pos.t < 15 * 60000 ? coordPrecise(a) : null, c = cp || (pos && Date.now() - pos.t < 15 * 60000 ? coordArret(a) : null);
    if (!c || !pos) return '';
    var route = distanceVol(pos, c);
    var d = (cp ? '' : '≈ ') + distanceCourte(route);
    var minPied = Math.max(1, Math.round(route * 15));
    var minVoit = Math.max(1, minutesTrajet(route * REGLAGES_MOTEUR.detourRoutier, '', a.commune || '', minutesMaintenant()));
    return '<span class="dist-moi' + (route < 0.5 ? ' tout-pres' : '') + '" role="img" aria-label="À ' + d + ' de vous, ' + formaterDureeTrajet(minPied) + ' à pied, ' + formaterDureeTrajet(minVoit) + ' en voiture">' +
      '<span class="dist-val" title="Distance">' + icone('cible') + d + '</span>' +
      '<span class="trajet-mode" title="À pied">' + icone('pieton') + formaterDureeTrajet(minPied) + '</span>' +
      '<span class="trajet-mode" title="En voiture">' + icone('voiture') + formaterDureeTrajet(minVoit) + '</span>' +
      '</span>';
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
          '<div class="rangee-actions-cr-valide">' +
          '<button class="bouton bouton-plein" type="button" data-a="quitterCarte">' + icone('fermer') + '<span>Sortir</span></button>' +
          (passeVerrouille(a.date) ? '' : '<button class="bouton" type="button" data-a="corriger" data-uid="' + a.uid + '">' + icone('crayon') + 'Modifier</button>') +
          '</div></div>';
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
        '<button type="button" data-a="couvPortee" data-v="semaine" aria-pressed="' + (portee === 'semaine') + '" title="Semaine">Sem.</button></div></div>';
    if (!ouverte) return h + '</section>';
    h += '<div class="carte-l" id="carteCouv">' + carteCouverture(dates, mes, eq) + '</div>' +
      '<div class="legende"><span><i class="q-moi"></i>Mes visites' + (portee === 'jour' ? ' (dans l\'ordre)' : '') + '</span><span><i class="q-equipe"></i>Équipe</span><span><i class="q-vide"></i>Commune non visitée</span></div>';
    cartesAFaire.push({ id: 'carteCouv', route: portee === 'jour' ? mes : [], points: portee === 'jour' ? [] : mes, equipe: eq,
      nonCouvertes: non.map(function (c) { return c.commune; }) });
    h += segment('Filtre', 'couvFiltre', [['toutes', 'Toutes'], ['couvertes', 'Visitées · ' + couv.length], ['non', 'Non visitées · ' + non.length]], S.ui.couvFiltre);
    var liste = S.ui.couvFiltre === 'couvertes' ? couv : (S.ui.couvFiltre === 'non' ? non : cv);
    var autresCommunes = [], interieurCommunes = [];
    liste.forEach(function (c) {
      if (c.zone === 'Zone Intérieur' || (c.zone && c.zone.toLowerCase().indexOf('intérieur') >= 0)) {
        interieurCommunes.push(c);
      } else {
        autresCommunes.push(c);
      }
    });

    var zone = '';
    h += '<ul class="liste-couv">';
    autresCommunes.forEach(function (c) {
      if (c.zone !== zone) { zone = c.zone; h += '<li class="couv-zone">' + esc(zone) + '</li>'; }
      var eqNoms = Object.keys(c.equipe);
      h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
        '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
        (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
        (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
        '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
    });

    if (interieurCommunes.length > 0) {
      var ouvInt = !!S.ui.couvInterieurOuverte;
      var nbVisInt = interieurCommunes.filter(function (x) { return x.moi > 0; }).length;
      h += '<li class="couv-zone couv-zone-interieur">' +
        '<button type="button" class="couv-zone-btn" data-a="couvInterieurToggle" aria-expanded="' + ouvInt + '">' +
        '<span>Zone Intérieur <small>(' + interieurCommunes.length + ' commune' + (interieurCommunes.length > 1 ? 's' : '') +
        (nbVisInt ? ' · ' + nbVisInt + ' visitée' + (nbVisInt > 1 ? 's' : '') : '') + ')</small></span>' +
        icone('chevron') +
        '</button></li>';
      if (ouvInt) {
        interieurCommunes.forEach(function (c) {
          var eqNoms = Object.keys(c.equipe);
          h += '<li class="couv-ligne ' + (c.moi ? 'oui' : (eqNoms.length ? 'equipe' : 'non')) + '"><span class="pastille"></span>' +
            '<div><b>' + esc(c.commune) + '</b><span class="discret bloc-texte">' +
            (c.moi ? c.moi + ' visite' + (c.moi > 1 ? 's' : '') + ' prévue' + (c.moi > 1 ? 's' : '') : 'Non visitée') +
            (eqNoms.length ? ' ; équipe : ' + eqNoms.map(function (n) { return esc(n) + ' (' + c.equipe[n] + ')'; }).join(', ') : '') +
            '</span></div><span class="couv-dispo">' + c.dispo + ' dispo.' + (c.prioritaires ? '<small>' + c.prioritaires + ' ★★★ en retard</small>' : '') + '</span></li>';
        });
      }
    }
    h += '</ul></section>';
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
  function deduireFicheProduit(nom, existantes) {
    nom = String(nom || '').trim();
    var kn = normaliser(nom);
    var parent = (existantes || []).filter(function (f) {
      var kf = normaliser(f.produit);
      return kn.indexOf(kf) === 0 || kf.indexOf(kn) === 0 || normaliser(f.gamme).indexOf(kn.split(' ')[0]) >= 0;
    })[0];

    if (parent) {
      return {
        gamme: parent.gamme,
        aire: parent.aire,
        produit: nom,
        dci: parent.dci || nom,
        classe: parent.classe || '',
        indications: parent.indications || '',
        contreIndications: parent.contreIndications || '',
        posologie: parent.posologie || '',
        precautions: parent.precautions || '',
        effetsIndesirables: parent.effetsIndesirables || '',
        arguments: parent.arguments || ''
      };
    }
    var gamme = nom, aire = 'Cardiologie & Métabolisme', classe = '';
    if (/zyltan|losartan/i.test(nom)) { gamme = 'Zyltan (losartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/lesstrol|lestrol/i.test(nom)) { gamme = 'Lesstrol (atorvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/tensicard/i.test(nom)) { gamme = 'Tensicard (aténolol)'; aire = 'Hypertension artérielle'; classe = 'Bêtabloquant'; }
    else if (/eurythmic/i.test(nom)) { gamme = 'Eurythmic (amiodarone)'; aire = 'Troubles du rythme cardiaque'; classe = 'Antiarythmique'; }
    else if (/telmikaa/i.test(nom)) { gamme = 'Telmikaa (telmisartan)'; aire = 'Hypertension artérielle'; classe = 'ARA II'; }
    else if (/rozukaa/i.test(nom)) { gamme = 'Rozukaa (rosuvastatine)'; aire = 'Cholestérol et risque cardiovasculaire'; classe = 'Statine'; }
    else if (/antiplatt/i.test(nom)) { gamme = 'Antiplatt (clopidogrel)'; aire = 'Prévention de la thrombose'; classe = 'Antiagrégant plaquettaire'; }
    else if (/myonit/i.test(nom)) { gamme = 'Myonit (trinitrine)'; aire = 'Angine de poitrine'; classe = 'Dérivé nitré'; }

    return {
      gamme: gamme,
      aire: aire,
      produit: nom,
      dci: nom,
      classe: classe,
      indications: 'Indication officielle selon notice du produit',
      contreIndications: '',
      posologie: 'Selon prescription médicale',
      precautions: '',
      effetsIndesirables: '',
      arguments: ''
    };
  }
  function fichesProduits() {
    var l = (S.data && S.data.fiches) || [];
    var fichesToutes = (l.length ? l : FICHES_PRODUITS_DEFAUT).slice();
    var inactifs = {};
    fichesToutes.forEach(function (f) {
      if (!estProduitActif(f)) inactifs[normaliser(f.produit)] = true;
    });
    var fiches = fichesToutes.filter(function (f) {
      return !inactifs[normaliser(f.produit)];
    });
    var prodsListes = (S.data && S.data.produits && S.data.produits.length) ? S.data.produits : PRODUITS_DEFAUT;
    var vus = {};
    fiches.forEach(function (f) { vus[normaliser(f.produit)] = true; });
    prodsListes.forEach(function (p) {
      var kp = normaliser(p);
      if (!vus[kp] && !inactifs[kp]) {
        var nouv = deduireFicheProduit(p, fiches);
        fiches.push(nouv);
        vus[kp] = true;
      }
    });
    return fiches;
  }
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
    var h = '<h2 class="titre-vue">Produits</h2><p class="sous-titre">Votre aide-mémoire de visite : produits, arguments clés et échantillons.</p>' +
      '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="rechProduit" placeholder="Produit, molécule, indication…" value="' + esc(S.ui.rechProduit || '') + '" aria-label="Rechercher un produit"></div></div>' +
      '<div class="defile" role="group" aria-label="Aire thérapeutique"><button type="button" class="puce" data-a="aireProduit" data-v="" aria-pressed="' + !aire + '">Tous</button>' +
      aires.map(function (x) { return '<button type="button" class="puce" data-a="aireProduit" data-v="' + esc(x) + '" aria-pressed="' + (aire === x) + '">' + esc(AIRES_COURTES[x] || x) + '</button>'; }).join('') + '</div>';
    if (!l.length) return h + '<div class="vide"><strong>Aucun produit</strong>Aucune fiche ne correspond.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="reinitFiltresProduits">' + icone('fermer') + 'Réinitialiser la recherche et les filtres</button></div></div>';
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
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
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
      '<h2 class="titre-vue">' + (A.ref ? 'Rattraper une visite' : S.ui.pharmaciesProches ? (S.ui.pharmaciesProches === 'Médecin' ? 'Médecins' : 'Pharmacies') + ' à proximité' : 'Autour de moi') + '</h2>' +
      '<p class="sous-titre">' + (A.ref ? 'Trouvez un praticien présent à proximité pour remplacer la visite annulée ou compléter votre journée.' : S.ui.pharmaciesProches === 'Médecin' ? 'Les médecins présents près de votre position, selon vos spécialités, à ajouter à votre tournée du jour.' : S.ui.pharmaciesProches ? 'Les pharmacies ouvertes près de votre position, à ajouter à votre tournée du jour.' : 'Médecin absent, trou dans la journée : trouvez qui est présent près de vous.') + '</p>';
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
    h += barreFiltres(S.ui.filtres, '', true);
    }

    if (S.ui.localisation && A.lat === null) return fin(h + '<div class="vide"><strong>Recherche de votre position…</strong>Les résultats s\'affichent dès qu\'elle est trouvée.</div>');
    if (A.lat === null) return fin(h + '<div class="vide"><strong>Où êtes-vous ?</strong>Utilisez votre position ou choisissez un quartier.</div>');
    var date, minute;
    if (A.moment === 'maintenant') { date = aujourdhui(); minute = minutesMaintenant(); }
    else { date = A.date || prochainJourOuvre(aujourdhui()); minute = heureVersMinutes(A.heure); }
    if (jourSemaineIndex(date) > 4) {
      return fin(h + '<div class="vide"><strong>Pas de présences le week-end</strong>Médecins et pharmacies sont affichés du lundi au vendredi. Choisissez « Autre moment » et un jour de semaine.</div>');
    }
    h += bandeauFeries([date]);
    var fa = S.ui.pharmaciesProches ? S.ui.filtresAutour : S.ui.filtres, filtre = criteresActifs(fa).length ? ensemble(filtrerPraticiens(fa, '').map(function (p) { return p.code; })) : null;
    // 3.25.8 : ceux déjà dans ma tournée ce jour-là sont omis
    var dansTournee = ensemble(S.plan.filter(function (a) { return a.date === date; }).map(function (a) { return a.code; }));
    var res = Moteur.autourDe(ctx(), { lat: A.lat, lon: A.lon }, date, minute, A.rayon)
      .filter(function (x) { return (!A.ref || x.c.code !== A.ref.code) && (!filtre || filtre[x.c.code]) && !dansTournee[x.c.code]; });
    S.ui.resAutour = res;
    // 3.25.15 : à 0,5 km (proximité immédiate), seulement ceux présents maintenant
    var immediat = +A.rayon === 0.5 && minute !== null;
    if (immediat) res = res.filter(function (x) { return x.etat === 'present'; }), S.ui.resAutour = res;
    var groupes = minute === null ? [['matin', 'Le matin'], ['soir', 'Le soir']] :
      (immediat ? [['present', 'Présents maintenant']] : [['present', 'Présents maintenant'], ['plustard', 'Plus tard dans la journée']]);
    h += '<p class="discret">' + majuscule(dateLongue(date)) + (minute !== null ? ', ' + minutesVersHeure(minute) : '') +
      ', autour de ' + esc(A.label || 'votre position') + (A.src === 'gps' && A.prec ? ' (précision ± ' + A.prec + ' m)' : '') + ' : ' + res.length + (fa.type === 'Pharmacie' ? ' pharmacie' : (fa.type === 'Médecin' ? ' médecin' : ' praticien')) + (res.length > 1 ? 's' : '') + '.</p>';
    groupes.forEach(function (g) {
      var l = res.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) { return o.x.etat === g[0]; });
      h += '<h3>' + g[1] + ' (' + l.length + ')</h3>';
      if (!l.length) { h += '<p class="discret">Aucun ' + (S.ui.pharmaciesProches === 'Pharmacie' ? 'pharmacie' : 'praticien') + ' dans ce rayon.</p>'; return; }
      h += '<ul class="liste">' + l.slice(0, 25).map(function (o) { return rendreProposition(o.x, o.i, date); }).join('') + '</ul>';
    });
    // 3.25.10 : rien dans le rayon : les plus proches au-delà, pour ne jamais laisser la page vide
    if (!res.length && !immediat) {
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
  // 3.25.37 : Carte médecin dans Journée -> Spécialité en premier, avant l'hôpital, puis secteur sans double espace
  function lieuQuartier(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(String(a.specialite).trim());
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      var q = (typeof nomSecteur === 'function' ? nomSecteur(a.quartier, a.commune, a.coord) : a.quartier) || a.quartier;
      if (q && (!hop || hop.toLowerCase().indexOf(q.toLowerCase()) < 0)) parts.push(q);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    var n = normaliser(a.nom), q = a.quartier && n.indexOf(normaliser(a.quartier)) >= 0 ? '' : a.quartier;
    return [lieuAffiche(a), q].filter(Boolean).join(', ').replace(/\s{2,}/g, ' ').trim();
  }
  function lieuEtSpec(a) {
    if (!estPharmacie(a)) {
      var parts = [];
      if (a.specialite) parts.push(String(a.specialite).trim());
      var hop = abregerHopital(a.lieu || lieuAffiche(a));
      if (hop) parts.push(hop);
      return parts.join(' · ').replace(/\s{2,}/g, ' ').trim();
    }
    return String(lieuAffiche(a) || '').replace(/\s{2,}/g, ' ').trim();
  }
  function nomSansType(nom) { return String(nom || '').replace(/^\s*pharmacie\s+/i, ''); }
  function metres(km) {
    if (km <= 0.035) return 'sur place (< 35 m)';
    var m = Math.max(10, Math.round(km * 100) * 10);
    return m <= 30 ? 'sur place (< 30 m)' : m + ' mètres';
  }
  function classeType(o) {
    var c = estPharmacie(o) ? ' t-pharma' : ' t-med';
    if (!o) return c;
    var conv = o.conventionne !== undefined ? o.conventionne : ((praticien(o.code) || {}).conventionne);
    if (!estPharmacie(o) && estConventionne(conv)) c += ' med-engage';
    return c;
  }
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

  VUES.equipe = function (integre) {
    var nomMoi = moi() || 'Moi', p = S.ui.eqPortee || 'semaine', ref = S.ui.eqDate || aujourdhui();
    var dates = p === 'semaine' ? joursOuvres(lundiDe(ref)) : [ref];
    var h = (integre ? '' : '<h2 class="titre-vue">Équipe</h2>') + barreQuiQuand('equipe') +
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
    if (!tous) {
      h += '<div style="margin:4px 0 8px"><button type="button" class="bouton-texte" data-a="collegueTous">← Revenir à toute l\'équipe</button></div>';
    }
    h += '<ul class="liste resume-equipe">' + noms.map(function (n) { return ligne(n, tout.filter(function (x) { return x.delegue === n; })); }).join('') + '</ul>';

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
      if (f.communes.length && !lieux.some(function (x) { return typeof communeCorrespondante === 'function' ? communeCorrespondante(x, co) : co[x.commune]; })) return false;
      if (f.visite !== 'tous') {
        var derDate = p.derniere;
        if (!derDate && S.data && S.data.historique) {
          S.data.historique.forEach(function (hv) {
            if (hv.code === p.code && hv.date && (!derDate || hv.date > derDate)) {
              derDate = String(hv.date).slice(0, 10);
            }
          });
        }
        if (typeof S !== 'undefined' && S.queue && S.queue.length) {
          S.queue.forEach(function (qv) {
            if (qv.code === p.code && qv.date && (!derDate || qv.date > derDate)) {
              derDate = String(qv.date).slice(0, 10);
            }
          });
        }
        var j = derDate ? joursEcoules(derDate, t) : Infinity;
        if (f.visite === '30' && j <= 30) return false;
        if (f.visite === 'recent' && (!derDate || j > 30)) return false;
        if (f.visite === 'jamais' && derDate) return false;
        if (f.visite === 'retard' && j < REGLAGES_MOTEUR.cadence[p.note]) return false;
        if (f.visite === 'revoir' && !aRevoir(p)) return false;
      }
      if (f.equipe !== 'tous' && (f.equipe === 'oui') !== (cibleParCollegues(p.code, t).length > 0)) return false;
      if (!q) return true;

      // 3.25.33 : Recherche dans le Répertoire ciblée sur le praticien
      // 1. Recherche par nom (Dr Kouassi, etc.) ou code (MED-xxx)
      var nomNorm = normaliser(p.nom || '');
      if (nomNorm.indexOf(q) >= 0 || normaliser(p.code || '').indexOf(q) >= 0) return true;

      // 2. Recherche par spécialité (ex: "cardio")
      if (normaliser(p.specialite || '').indexOf(q) >= 0) return true;

      // 3. Lieux / Communes / Quartiers : uniquement à partir de 4 caractères
      // (évite que taper 'kou' pour chercher Kouassi ramène tous les praticiens de Koumassi sans ce nom)
      if (q.length >= 4) {
        var txtLieux = lieux.map(function (x) { return x.lieu + ' ' + x.quartier + ' ' + x.commune; }).join(' ');
        var mots = normaliser(txtLieux).split(' ');
        if (mots.some(function (w) { return w.indexOf(q) === 0; })) return true;
      }
      return false;
    });
  }
  var LIB_VISITE = { '30': 'Non visité depuis +30 j', recent: 'Visité -30 j', jamais: 'Jamais visité',
                     retard: 'En retard', revoir: 'À revoir' };
  // Liste des critères actifs : [clé, valeur, libellé]
  function criteresActifs(f) {
    var l = [];
    if (f.type !== 'tous') l.push(['type', f.type, f.type === 'Pharmacie' ? 'Pharmacies' : 'Médecins']);
    f.potentiels.forEach(function (x) { l.push(['potentiels', x, ETOILES[x]]); });
    if (f.type !== 'Pharmacie' && !sontToutesSpecialites(f.specialites)) f.specialites.forEach(function (x) { l.push(['specialites', x, x]); });
    f.communes.forEach(function (x) { l.push(['communes', x, x]); });
    if (f.visite !== 'tous') l.push(['visite', f.visite, LIB_VISITE[f.visite]]);
    if (f.conv !== 'tous') l.push(['conv', f.conv, f.conv === 'oui' ? 'Engagés' : 'Non engagés']);
    if (f.equipe !== 'tous') l.push(['equipe', f.equipe, f.equipe === 'oui' ? 'Ciblés par l\'équipe' : 'Non ciblés par l\'équipe']);
    return l;
  }
  var FILTRES_RAPIDES = [['potentiels', 'A', '★★★'], ['visite', 'recent', 'Visité -30 j'], ['visite', '30', 'Non visité +30 j'],
                         ['visite', 'revoir', 'À revoir'], ['visite', 'jamais', 'Jamais visité'], ['conv', 'oui', 'Engagés']];
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
  function memeEnsembleSpecs(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    var sa = a.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    var sb = b.filter(function (x) { return x && x !== 'Pharmacien'; }).sort();
    if (sa.length !== sb.length) return false;
    for (var i = 0; i < sa.length; i++) {
      if (sa[i] !== sb[i]) return false;
    }
    return true;
  }

  function etapesFiltres(f) {
    var vis = [['tous', 'Toutes'], ['recent', 'Visité -30 j'], ['30', 'Non visité +30 j'], ['jamais', 'Jamais visité'], ['retard', 'En retard'], ['revoir', 'À revoir']];
    var l = [
      { id: 'qui', auto: true, resume: function () { return f.type === 'Pharmacie' ? 'Pharmacies' : (f.type === 'Médecin' ? 'Médecins' : 'Médecins et pharmacies'); },
        rendu: function () {
          return '<div class="puces">' + [['Médecin', 'Médecins'], ['Pharmacie', 'Pharmacies'], ['tous', 'Tous']].map(function (x) { return puceEtape('type', x[0], x[1], f.type === x[0], false, 'qui'); }).join('') + '</div>' +
            '<p class="discret raccourcis-titre-etape">Ou directement un raccourci :</p><div class="puces">' + FILTRES_RAPIDES.map(function (x) {
              return '<button type="button" class="puce petite" data-a="filtreRapide" data-fin="1" data-k="' + x[0] + '" data-v="' + x[1] + '" aria-pressed="' + filtreRapideActif(f, x[0], x[1]) + '">' + esc(x[2]) + '</button>';
            }).join('') + '</div>';
        } },
      { id: 'spec', si: f.type !== 'Pharmacie', resume: function () {
          if (!f.specialites.length) return 'Toutes';
          if (memeEnsembleSpecs(f.specialites, coeurDeCible())) return 'Cœur de cible';
          if (sontToutesSpecialites(f.specialites)) return 'Toutes';
          return f.specialites.length <= 2 ? f.specialites.join(', ') : f.specialites.slice(0, 2).join(', ') + ' +' + (f.specialites.length - 2);
        },
        rendu: function () {
          return '<p class="discret" style="margin:0 0 6px">' + (f.type === 'tous' ? 'Spécialités du cœur de cible pré-sélectionnées (les pharmacies restent affichées) :' : 'Spécialités du cœur de cible pré-sélectionnées (modifier met à jour votre cœur de cible) :') + '</p>' +
            pucesSpecialitesCible(f.specialites, 'filtreSpecToggle', 'filtreSpecToutes', 'filtreSpecCoeur', 'filtreSpecChoisir');
        } },
      { id: 'com', resume: function () { return f.communes.length ? condenserCommunesEtSecteurs(f.communes) : 'Toutes'; },
        rendu: function () {
          return '<p class="discret" style="margin:4px 0 8px">' + (f.communes.length ? esc(condenserCommunesEtSecteurs(f.communes)) : 'Toutes les communes') + '</p>' +
            '<button class="bouton petit" type="button" data-a="filtreQuestion" data-v="com">' + icone('loupe') + 'Choisir les communes</button>';
        } },
      { id: 'valeur', resume: function () {
          var r = f.potentiels.map(function (x) { return ETOILES[x]; }); if (f.conv !== 'tous') r.push(f.conv === 'oui' ? 'Engagés' : 'Non engagés');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Potentiel</span><div class="puces"><button type="button" class="puce puce-tous" data-a="etapeFiltre" data-k="potentiels" data-v="tous" aria-pressed="' + (!f.potentiels.length || f.potentiels.length === 3) + '">Tous</button>' +
            [['A', '★★★'], ['B', '★★'], ['C', '★']].map(function (x) { return puceEtape('potentiels', x[0], x[1], f.potentiels.indexOf(x[0]) >= 0, true); }).join('') + '</div>' +
            '<span class="sous-etape">Engagé</span><div class="puces">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('conv', x[0], x[1], f.conv === x[0]); }).join('') + '</div>';
        } },
      { id: 'suivi', resume: function () {
          var r = []; if (f.visite !== 'tous') r.push(LIB_VISITE[f.visite]);
          if (f.equipe !== 'tous' && !S.config.demo) r.push(f.equipe === 'oui' ? 'Prévus par un collègue' : 'Non prévus par un collègue');
          return r.length ? r.join(' · ') : 'Tous'; },
        rendu: function () {
          return '<span class="sous-etape">Dernière visite (un seul choix)</span><div class="puces puces-suivi-visite">' + vis.map(function (x) { return puceEtape('visite', x[0], x[1], f.visite === x[0]); }).join('') + '</div>' +
            (S.config.demo ? '' : '<span class="sous-etape">Prévu par un collègue cette semaine</span><div class="puces puces-equipe-semaine">' + [['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']].map(function (x) { return puceEtape('equipe', x[0], x[1], f.equipe === x[0]); }).join('') + '</div>');
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

  var ABREV_SPEC = {
    'cardiologie': 'cardio',
    'cardiologue': 'cardio',
    'diabétologie': 'diabéto',
    'diabétologue': 'diabéto',
    'diabetologie': 'diabéto',
    'diabetologue': 'diabéto',
    'gynécologie': 'gynéco',
    'gynécologue': 'gynéco',
    'gynecologie': 'gynéco',
    'gynecologue': 'gynéco',
    'gynécologie obstétrique': 'gynéco-obs',
    'pédiatrie': 'pédia',
    'pédiatre': 'pédia',
    'pediatrie': 'pédia',
    'pediatre': 'pédia',
    'gastro-entérologie': 'gastro',
    'gastro-entérologue': 'gastro',
    'dermatologie': 'dermato',
    'dermatologue': 'dermato',
    'rhumatologie': 'rhumato',
    'rhumatologue': 'rhumato',
    'pneumologie': 'pneumo',
    'pneumologue': 'pneumo',
    'neurologie': 'neuro',
    'neurologue': 'neuro',
    'ophtalmologie': 'ophtalmo',
    'ophtalmologue': 'ophtalmo',
    'psychiatrie': 'psy',
    'psychiatre': 'psy',
    'urologie': 'uro',
    'urologue': 'uro',
    'néphrologie': 'néphro',
    'néphrologue': 'néphro',
    'endocrinologie': 'endocrino',
    'endocrinologue': 'endocrino',
    'orl': 'ORL',
    'oto-rhino-laryngologie': 'ORL',
    'médecine générale': 'généraliste',
    'médecin généraliste': 'généraliste',
    'généraliste': 'généraliste'
  };

  function abbrevSpec(x) {
    if (!x) return '';
    var k = String(x).toLowerCase().trim();
    if (ABREV_SPEC[k]) return ABREV_SPEC[k];
    return x;
  }

  // Résumé des critères retenus, concis et abrégé (ex. « 11 médecins · ★★★ · Cocody · > 30j sans visite »)
  function phraseCriteres(f, q, n, tri) {
    var fem = f.type === 'Pharmacie', pl = n > 1, s = pl ? 's' : '', e = fem ? 'e' : '';
    var nom = f.type === 'Pharmacie' ? 'pharmacie' : (f.type === 'Médecin' ? 'médecin' : 'praticien');
    var t = (n ? n : 'Aucun' + (fem ? 'e' : '')) + ' ' + nom + (pl ? 's' : '');
    var c = [];
    if (f.type !== 'Pharmacie') {
      if (sontToutesSpecialites(f.specialites)) {
        c.push('toutes spécialités');
      } else if (f.specialites.length) {
        t += ' ' + f.specialites.map(function (x) {
          var ab = abbrevSpec(x);
          return pl && !/[sx]$/.test(ab) ? ab + 's' : ab;
        }).join(' ou ');
        if (f.type === 'tous') t += ' (+ officines)';
      }
    }
    if (f.potentiels.length) c.push(f.potentiels.map(function (x) { return ETOILES[x]; }).join('/'));
    if (f.conv !== 'tous') c.push(f.conv === 'oui' ? 'engagés' : 'non engagés');
    var vis = {
      '30': '> 30j sans visite',
      recent: '< 30j',
      jamais: 'jamais visités',
      retard: 'en retard',
      revoir: 'à revoir'
    };
    if (f.visite !== 'tous') c.push(vis[f.visite] || f.visite);
    if (f.equipe !== 'tous') c.push((f.equipe === 'oui' ? 'prévus' : 'non prévus') + ' collègue');
    if (f.communes.length) {
      var comAffiche = condenserCommunesEtSecteurs(f.communes);
      if (comAffiche) c.push(comAffiche);
    }
    if (q && String(q).trim()) c.push('« ' + String(q).trim() + ' »');
    var lt = { priorite: 'tri potentiel', score: 'tri priorité', retard: 'tri retard', nom: 'tri nom' };
    if (n > 1 && lt[tri]) c.push(lt[tri]);
    var aucunFiltre = f.type === 'tous' && (!f.communes || !f.communes.length) && (!f.potentiels || !f.potentiels.length) &&
                      f.visite === 'tous' && f.conv === 'tous' && f.equipe === 'tous' && (!q || !String(q).trim());
    if (aucunFiltre) {
      return t + ' · Toute la base de données';
    }
    if (!c.length) c.push('Toute la base de données');
    return t + ' · ' + c.join(' · ');
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
      return '<div class="page-entree"><button type="button" class="retour" data-a="rechFermer">' + icone('chevron') + 'Répertoire</button>' +
        '<h2 class="titre-vue">Critères de recherche</h2><p class="sous-titre">Une question à la fois ; les résultats s\'affichent à la fin.</p>' +
        '<section class="bloc">' + barreFiltres(f, S.ui.recherche, true) + '</section>' +
        '<button class="bouton bouton-plein bouton-large" type="button" data-a="rechFermer">' + icone('loupe') + 'Voir ' + (liste.length ? 'les ' + liste.length + ' résultat' + (liste.length > 1 ? 's' : '') : 'les résultats') + '</button></div>';
    }
    var h = '<div class="tete-vue"><h2 class="titre-vue">Répertoire</h2></div>' +
      '<p class="sous-titre">Tous vos contacts : recherchez, filtrez, mettez à jour leurs fiches et leurs lieux de visite.</p>';
    h += '<div class="barre-recherche"><div class="recherche">' + icone('loupe') + '<input type="search" data-f="recherche" placeholder="Nom, spécialité, établissement, quartier…" value="' +
        esc(S.ui.recherche) + '" aria-label="Rechercher un praticien"></div></div>';
    h += '<div class="rangee-actions-rep">' +
      '<button class="bouton bouton-criteres" type="button" data-a="rechOuvrir">' + icone('filtre') + '<span>Recherche</span></button>' +
      '<button class="bouton bouton-plein bouton-ajouter-rep" type="button" data-a="nouvelleFiche">' + icone('plus') + '<span>Ajouter</span></button>' +
      '<button class="bouton bouton-modifier-rep" type="button" data-a="modifierActif">' + icone('crayon') + '<span>Modifier</span></button>' +
      '</div>';
    var aFiltres = criteresActifs(f).length > 0 || !!(S.ui.recherche && String(S.ui.recherche).trim());
    var phrase = phraseCriteres(f, S.ui.recherche, liste.length, S.ui.tri);
    h += '<div class="bandeau-criteres-rep">' +
      '<p class="phrase-criteres">' + esc(phrase) + '</p>' +
      '<div class="centre-reinit-rep">' +
        (aFiltres
          ? '<button type="button" class="bouton-reinit-rep" data-a="effacerFiltres" title="Réinitialiser les filtres et recommencer">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>'
          : '<button type="button" class="bouton-reinit-rep desactive" disabled title="Aucun filtre actif">' +
              icone('relancer') + '<span>Réinitialiser les filtres</span>' +
            '</button>') +
      '</div>' +
      '</div>';
    if (!liste.length) return h + '<div class="vide"><strong>Aucun praticien</strong>Aucun praticien ne correspond à tous ces critères.<div style="margin-top:14px"><button class="bouton bouton-plein" type="button" data-a="effacerFiltres">' + icone('relancer') + 'Réinitialiser les filtres et recommencer</button></div></div>';
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
        var nbLieux = lieux.length || 1;
        var nbGpsFixes = lieux.filter(function (l) {
          var lt = l.lat != null ? +String(l.lat).replace(',', '.') : NaN;
          return isFinite(lt) && lt !== 0;
        }).length;
        var badgeGpsClasse = nbGpsFixes === nbLieux ? 'fixe' : (nbGpsFixes > 0 ? 'partiel' : 'manquant');
        var badgeGpsHtml = icone('carte') + '<span>' + nbGpsFixes + '/' + nbLieux + '</span>';
        var tAuj = aujourdhui();
        var dejaAuj = S.plan.some(function (a) { return a.code === p.code && a.date === tAuj; });

        h += '<div class="bloc-actions-contact" style="margin-top:10px">' +
          '<button class="bouton bouton-plein bouton-gps-ici" type="button" data-a="majGpsDirect" data-v="' + esc(p.code) + '" title="' + (nbLieux > 1 ? 'Capter la position GPS de l\'établissement où vous êtes sur place' : 'Capter votre position GPS précise') + '">' +
            '<span class="gps-ici-gauche">' + icone('carte') + '<b>Capter position GPS</b></span>' +
            '<span class="gps-ici-badge ' + badgeGpsClasse + '" title="' + nbGpsFixes + ' sur ' + nbLieux + ' lieu(x) géolocalisé(s)">' + badgeGpsHtml + '</span>' +
          '</button>' +
          '<div class="rangee rangee-actions-contact">' +
            (dejaAuj
              ? '<span class="badge-deja-prevu">' + icone('valider') + 'Prévu ce jour</span>'
              : '<button class="bouton bouton-inopinee" type="button" data-a="visiteInopineeDirect" data-v="' + esc(p.code) + '" title="Ajouter immédiatement à la tournée d\'aujourd\'hui">' +
                  icone('eclair') + '<span>Ajouter au jour</span></button>') +
            '<button class="bouton" type="button" data-a="imposerDirect" data-v="' + esc(p.code) + '">' + icone('calendrier') + '<span>' + (impose ? 'Re-planifier' : 'Planifier') + '</span></button>' +
            '<button class="bouton" type="button" data-a="modifierFiche" data-v="' + esc(p.code) + '">' + icone('crayon') + '<span>Modifier</span></button>' +
          '</div></div>';
      }
      h += '</li>';
    });
    h += '</ul>';
    if (liste.length > S.ui.limite) h += '<button class="bouton bouton-large" type="button" data-a="plus">Afficher plus</button>';
    return h;
  };

  // Planning hebdomadaire d'un praticien (lieux x jours)
  function grillePresences(code) {
    var c = ctx(), p = praticien(code) || {}, estPh = p.type === 'Pharmacie', lieux = c.presencesParCode[code] || [];
    if (!lieux.length) {
      return '<div class="bloc-presences" style="margin:8px 0;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">' +
        '<p class="discret" style="margin:0 0 6px;text-align:center">Aucune présence ou horaire renseigné.</p>' +
        '<button class="bouton petit" type="button" data-a="modifierPlanning" data-v="' + esc(code) + '" style="margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px">' +
        icone('crayon') + (estPh ? ' Renseigner les horaires' : ' Renseigner le planning') + '</button></div>';
    }
    var h = '<div class="grille-pres">';
    if (estPh) {
      var l0 = lieux[0] || {};
      var hM = lireHoraire(l0.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(l0.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      h += '<div class="horaires-pharma-vue" style="margin:4px 0 8px;padding:8px 10px;background:var(--fond,#f4f7f8);border-radius:8px;font-size:13px">' +
        '<b>' + icone('horloge') + ' Horaires de réception :</b> ' +
        '<span>Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) + '</span> · ' +
        '<span>Soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]) + '</span>' +
        '</div>';
    }
    h += '<table><thead><tr><th>' + (estPh ? 'Officine' : 'Lieu') + '</th>' + JOURS.map(function (j) { return '<th>' + j.slice(0, 3) + '</th>'; }).join('') + '</tr></thead><tbody>';
    lieux.forEach(function (pr, idx) {
      var hM = lireHoraire(pr.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut), hS = lireHoraire(pr.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      var hasGps = pr.lat && pr.lon && isFinite(+String(pr.lat).replace(',', '.')) && +String(pr.lat).replace(',', '.') !== 0;
      var nomLieu = abregerHopital(pr.lieu || (estPh ? p.nom : 'Établissement'));
      var quartierNet = String(pr.quartier || '').replace(/\bBoulevard\b/gi, 'Blvd.');
      var adresseTxt = [quartierNet, pr.commune].filter(Boolean).join(', ');
      h += '<tr class="tr-lieu-titre"><td colspan="6" class="cell-lieu-titre"><b class="lieu-nom-plein" title="' + esc(nomLieu) + '">' + esc(nomLieu) + '</b></td></tr>' +
        '<tr class="tr-lieu-corps"><td class="cell-lieu-infos"><small>' + esc(adresseTxt) + '<br>Matin ' + minutesVersHeure(hM[0]) + '-' + minutesVersHeure(hM[1]) +
        ', soir ' + minutesVersHeure(hS[0]) + '-' + minutesVersHeure(hS[1]) + '</small>' +
        '<div class="ligne-micro-gps-plan" style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:nowrap;white-space:nowrap"><button type="button" class="btn-micro-gps ' + (hasGps ? 'fixe' : 'manquant') + '" data-a="majGpsLieuDirect" data-v="' + esc(code) + '" data-i="' + idx + '" title="' + (hasGps ? 'GPS déjà fixé pour cet établissement. Touchez pour réactualiser sur place' : 'Touchez pour capter et fixer le GPS de cet établissement') + '">' +
          icone('carte') + '<span>GPS</span></button>' +
          (!estPh ? '<span class="discret texte-aide-plan" style="font-size:11px;line-height:1.2;white-space:nowrap;flex-shrink:0">Touchez M ou S pour planifier</span>' : '') +
        '</div>' +
        '</td>' +
        JOURS_CLES.map(function (j, i) {
          var d = lireDispo(pr[j]);
          var t = d.matin && d.soir ? 'M S' : (d.matin ? 'M' : (d.soir ? 'S' : ''));
          if (!t) return '<td class="dispo-vide"></td>';
          var cleM = pr.id + '|' + i + '|Matin', cleS = pr.id + '|' + i + '|Soir';
          return '<td class="dispo">' + (d.matin ? '<button type="button" class="btn-m" data-a="planifierCle" data-v="' + esc(cleM) + '" title="Planifier ' + JOURS[i] + ' matin">M</button>' : '') +
            (d.soir ? '<button type="button" class="btn-s" data-a="planifierCle" data-v="' + esc(cleS) + '" title="Planifier ' + JOURS[i] + ' soir">S</button>' : '') + '</td>';
        }).join('') + '</tr>';
    });
    h += '</tbody></table></div>' +
      '<div class="pres-actions" style="margin-top:8px;text-align:center;width:100%">' +
        '<button type="button" class="bouton-texte" data-a="modifierPlanning" data-v="' + esc(code) + '" style="margin:0 auto;display:inline-flex;align-items:center;justify-content:center;gap:6px">' +
        icone('crayon') + (estPh ? ' Modifier les horaires' : ' Modifier le planning hebdomadaire') + '</button>' +
      '</div>';
    return h;
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
  function formatQui() {
    var f = S.ui.fq;
    if (f.qui === 'tous') return { plein: 'Toute l\'équipe', court: 'Équipe' };
    if (f.qui === 'liste') {
      var t = f.liste.length > 2 ? f.liste.length + ' délégués' : f.liste.map(function (x) { return estMoi(x) ? 'Moi' : x.split(' ')[0]; }).join(', ');
      return { plein: t, court: t };
    }
    return { plein: 'Moi', court: 'Moi' };
  }
  function libelleQui() {
    return formatQui().plein;
  }
  function formatQuand(onglet) {
    var MOIS_COURTS = ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    if (onglet === 'equipe') {
      if (S.ui.eqPortee === 'jour') {
        var d = S.ui.eqDate || aujourdhui();
        return { plein: majuscule(dateCourte(d)), court: majuscule(dateCourte(d)) };
      }
      var l = lundiDe(S.ui.eqDate || aujourdhui());
      return { plein: 'Semaine du ' + dateCourte(l), court: 'Sem. ' + dateCourte(l) };
    }
    var b = bornesStats(), st = S.ui.stats;
    if (b[0] === b[1]) {
      var d = majuscule(dateCourte(b[0]));
      return { plein: d, court: d };
    }
    if (st.periode === 'semaine') {
      return { plein: 'Semaine du ' + dateCourte(b[0]), court: 'Sem. ' + dateCourte(b[0]) };
    }
    if (st.periode === 'mois') {
      var mIdx = +b[0].slice(5, 7) - 1, annee = b[0].slice(0, 4);
      var mLong = majuscule(MOIS[mIdx]) + ' ' + annee;
      var mCourt = MOIS_COURTS[mIdx] + ' ' + annee;
      return { plein: mLong, court: mCourt };
    }
    return { plein: 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]), court: dateCourte(b[0]) + ' - ' + dateCourte(b[1]) };
  }
  function libelleBornes(b) {
    var st = S.ui.stats;
    if (b[0] === b[1]) return majuscule(dateCourte(b[0]));
    if (st.periode === 'semaine') return 'Semaine du ' + dateCourte(b[0]);
    if (st.periode === 'mois') return majuscule(MOIS[+b[0].slice(5, 7) - 1]) + ' ' + b[0].slice(0, 4);
    return 'Du ' + dateCourte(b[0]) + ' au ' + dateCourte(b[1]);
  }
  function barreQuiQuand(onglet) {
    var quiObj = formatQui();
    var qObj = formatQuand(onglet);
    var nav = onglet === 'equipe' || S.ui.stats.periode !== 'perso';
    return '<div class="barre-qq">' +
      (S.config.demo ? '' : '<button type="button" class="puce-filtre" data-a="quiOuvrir">' + icone('equipe') + '<span><span class="txt-plein">' + esc(quiObj.plein) + '</span><span class="txt-court">' + esc(quiObj.court) + '</span></span><b>▾</b></button>') +
      '<div class="qq-quand">' + (nav ? '<button type="button" class="bouton-icone sombre" data-a="quandDecaler" data-o="' + onglet + '" data-v="-1" aria-label="Période précédente">' + icone('chevron') + '</button>' : '') +
      '<button type="button" class="puce-filtre" data-a="quandOuvrir" data-o="' + onglet + '">' + icone('calendrier') + '<span><span class="txt-plein">' + esc(qObj.plein) + '</span><span class="txt-court">' + esc(qObj.court) + '</span></span><b>▾</b></button>' +
      (nav ? '<button type="button" class="bouton-icone sombre suivant" data-a="quandDecaler" data-o="' + onglet + '" data-v="1" aria-label="Période suivante">' + icone('chevron') + '</button>' : '') + '</div></div>';
  }
  FEUILLES.calendrierJour = function (f) {
    var curMois = f.mois || f.date.slice(0, 7), t = aujourdhui();
    var parts = curMois.split('-'), y = +parts[0], m = +parts[1];
    var nomMois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'][m - 1];
    var rDemain = ajouterJours(t, 1), rSem = ajouterJours(t, 7), r2Sem = ajouterJours(t, 14);
    var raccourcis = '<div class="cal-raccourcis">' +
      '<button type="button" class="puce' + (f.date === t ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + t + '">Aujourd\'hui</button>' +
      '<button type="button" class="puce' + (f.date === rDemain ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rDemain + '">Demain</button>' +
      '<button type="button" class="puce' + (f.date === rSem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + rSem + '">+7 jours</button>' +
      '<button type="button" class="puce' + (f.date === r2Sem ? ' actif' : '') + '" data-a="calChoisirJour" data-v="' + r2Sem + '">+14 jours</button>' +
      '</div>';
    var chevronG = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m15 18-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var chevronD = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var barreMois = '<div class="cal-barre-mois">' +
      '<div class="cal-titre-mois"><b>' + nomMois + '</b><span class="cal-an-badge">' + y + '</span></div>' +
      '<div class="cal-navs">' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="-1" aria-label="Mois précédent">' + chevronG + '</button>' +
        '<button type="button" class="cal-nav-btn" data-a="calChangerMois" data-v="1" aria-label="Mois suivant">' + chevronD + '</button>' +
      '</div>' +
      '</div>';
    var entetes = '<div class="cal-grille-semaine">' +
      ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(function (j) { return '<span>' + j + '</span>'; }).join('') +
      '</div>';
    var premierJour = new Date(y, m - 1, 1);
    var dec = (premierJour.getDay() + 6) % 7;
    var nbJoursMois = new Date(y, m, 0).getDate();
    var nbJoursPrec = new Date(y, m - 1, 0).getDate();
    var cellules = [];
    for (var i = dec - 1; i >= 0; i--) {
      var jPrec = nbJoursPrec - i, mPrec = m === 1 ? 12 : m - 1, yPrec = m === 1 ? y - 1 : y;
      cellules.push({ num: jPrec, iso: yPrec + '-' + pad2(mPrec) + '-' + pad2(jPrec), horsMois: true });
    }
    for (var j = 1; j <= nbJoursMois; j++) {
      cellules.push({ num: j, iso: y + '-' + pad2(m) + '-' + pad2(j), horsMois: false });
    }
    // Strictement 42 cases (6 semaines complètes) : hauteur 100% stable sans aucun saut
    var reste = 42 - cellules.length;
    for (var k = 1; k <= reste; k++) {
      var mSuiv = m === 12 ? 1 : m + 1, ySuiv = m === 12 ? y + 1 : y;
      cellules.push({ num: k, iso: ySuiv + '-' + pad2(mSuiv) + '-' + pad2(k), horsMois: true });
    }
    var grille = '<div class="cal-grille-jours">' + cellules.map(function (c) {
      var nVisites = nbVisitesJour(c.iso), estAuj = c.iso === t, estChoisi = c.iso === f.date;
      var classes = ['cal-jour-btn'];
      if (c.horsMois) classes.push('hors-mois');
      if (estAuj) classes.push('aujourdhui');
      if (estChoisi) classes.push('choisi');
      if (nVisites > 0) classes.push('avec-visites');
      return '<button type="button" class="' + classes.join(' ') + '" data-a="calChoisirJour" data-v="' + c.iso + '">' +
        '<span>' + c.num + '</span>' +
        (nVisites > 0 ? '<span class="cal-point-visite"></span>' : '') +
        '</button>';
    }).join('') + '</div>';
    return '<div class="cal-boite">' + raccourcis + barreMois + entetes + grille + '</div>';
  };
  FEUILLES.qui = function (f) {
    var noms = nomsDelegues(), tousChoisis = noms.length > 0 && noms.every(function (n) { return f.liste.indexOf(n) >= 0; });
    return '<div class="segment" role="group" aria-label="Qui" style="margin-top:0">' + [['moi', 'Moi'], ['tous', 'Toute l\'équipe'], ['liste', 'Choisir']].map(function (x) {
        return '<button type="button" data-a="quiMode" data-v="' + x[0] + '" aria-pressed="' + (f.qui === x[0]) + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      (f.qui === 'liste' ? '<p class="discret" style="margin:4px 0 8px">Touchez les délégués à réunir dans le bilan.</p><div class="puces">' +
        (noms.length > 1 ? '<button type="button" class="puce puce-tous" data-a="quiTous" aria-pressed="' + tousChoisis + '">Tous</button>' : '') +
        noms.map(function (n) {
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
    var filtre = !eq ? filtreCibles() : null;
    Object.keys(prat).forEach(function (k) {
      var p = prat[k]; if (p.note !== 3) return;
      if (filtre && !filtre(p)) return;
      nA++; if (joursEcoules(p.derniere, t) <= REGLAGES_MOTEUR.cadence[3]) nAok++;
    });
    return { bornes: b, equipe: eq, visites: visites, effectives: effectives, plan: plan, echus: echus, faits: faits,
             nbDel: nbDel, delegues: Object.keys(delegues).sort(), ouvres: ouvres, objectif: objectif, nA: nA, nAok: nAok };
  }
  function taux(a, b) { return b ? Math.round(100 * a / b) : null; }
  function txt(n) { return n === null || n === undefined ? 'n.d.' : n + ' %'; }

  VUES.recherche = VUES.praticiens;
  VUES.contacts = VUES.praticiens;

  // 3.26.0 : Onglet Suivi unifié regroupant Bilan, Tournées Équipe et Audit Données/GPS
  VUES.suivi = function () {
    var sousVue = S.ui.suiviVue || 'bilan';
    var tete = '<div class="tete-vue"><h2 class="titre-vue">Suivi & Contrôle</h2></div>' +
      '<p class="sous-titre">Pilotez votre activité : réalisations, tournées de l\'équipe et qualité des données.</p>' +
      '<div class="segment-suivi" style="margin:4px 0 10px">' +
      segment('Sous-onglet Suivi', 'suiviVue', [['bilan', 'Bilan'], ['equipe', 'Équipe'], ['audit', 'Audit']], sousVue) +
      '</div>';
    return tete + (sousVue === 'equipe' ? VUES.equipe(true) : (sousVue === 'audit' ? VUES.audit(true) : VUES.bilan(true)));
  };

  VUES.audit = function (integre) {
    if (!S.data || !S.data.praticiens || !S.data.praticiens.length) {
      return (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Données & GPS</h2></div>') +
        '<div class="vide"><strong>Aucune donnée</strong>Connectez un Google Sheet ou chargez les données de démonstration pour auditer la base.</div>';
    }

    var prats = S.data.praticiens, pres = S.data.presences || [], qList = quartiers();
    var qMap = {}; qList.forEach(function (q) { qMap[(q.quartier || '').trim().toLowerCase()] = q; });
    var presParCode = {}; pres.forEach(function (p) { (presParCode[p.code] = presParCode[p.code] || []).push(p); });

    var filtreAnomalie = S.ui.auditFiltre || 'tous';

    var total = prats.length;
    var sansGps = [], horsCi = [], ecartGeo = [], sansPresence = [], conformes = 0;
    var coordGroupes = {};

    prats.forEach(function (p) {
      var sesPres = presParCode[p.code] || [];
      var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
      var p0 = sesPres[0] || {};
      var lat = parseFloat(String(p0.lat || p.lat || '').replace(',', '.'));
      var lon = parseFloat(String(p0.lon || p.lon || '').replace(',', '.'));
      var aGps = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
      var dansCi = aGps && (lat >= 4.3 && lat <= 10.8) && (lon >= -8.6 && lon <= -2.4);

      var anomalie = null;

      if (!sesPres.length && !estPh) {
        sansPresence.push({ p: p, pres: p0, motif: 'Aucun créneau ni établissement renseigné' });
        anomalie = 'sansPresence';
      } else if (!aGps) {
        sansGps.push({ p: p, pres: p0, motif: 'Coordonnées GPS manquantes ou à zéro' });
        anomalie = 'sansGps';
      } else if (!dansCi) {
        horsCi.push({ p: p, pres: p0, motif: 'Coordonnées hors Côte d\'Ivoire (' + lat.toFixed(4) + ', ' + lon.toFixed(4) + ')' });
        anomalie = 'horsCi';
      } else {
        var cleCoord = lat.toFixed(3) + '|' + lon.toFixed(3);
        coordGroupes[cleCoord] = coordGroupes[cleCoord] || [];
        coordGroupes[cleCoord].push({ p: p, pres: p0, lat: lat, lon: lon });

        var quartNom = (p0.quartier || p.quartier || '').trim().toLowerCase();
        var qRef = qMap[quartNom];
        if (!quartNom || quartNom === 'nl') {
          ecartGeo.push({ p: p, pres: p0, motif: 'Quartier non renseigné ou non localisé (NL)' });
          anomalie = 'ecartGeo';
        } else if (qRef && isFinite(qRef.lat)) {
          var dist = distanceVol({ lat: lat, lon: lon }, { lat: qRef.lat, lon: qRef.lon });
          if (dist > 8) {
            ecartGeo.push({ p: p, pres: p0, motif: 'Écart de ' + Math.round(dist) + ' km avec le quartier ' + qRef.quartier + ' (' + qRef.commune + ')' });
            anomalie = 'ecartGeo';
          }
        }
      }

      if (!anomalie) conformes++;
    });

    var centroides = [];
    Object.keys(coordGroupes).forEach(function (k) {
      var grp = coordGroupes[k];
      if (grp.length >= 3) {
        var lieuxUniques = {};
        grp.forEach(function (item) {
          var nLieu = normaliser((item.pres && item.pres.lieu) || item.p.nom || '');
          lieuxUniques[nLieu] = (lieuxUniques[nLieu] || 0) + 1;
        });
        var nbLieuxDistincts = Object.keys(lieuxUniques).length;
        if (nbLieuxDistincts >= 2) {
          grp.forEach(function (item) {
            centroides.push({ p: item.p, pres: item.pres, motif: 'Centroïde suspect : ' + nbLieuxDistincts + ' établissements distincts au même point (' + item.lat.toFixed(4) + ', ' + item.lon.toFixed(4) + ')' });
          });
        }
      }
    });

    var scoreSante = Math.round((conformes / total) * 100);

    var h = (integre ? '' : '<div class="tete-vue"><h2 class="titre-vue">Audit Qualité BDD & GPS</h2></div>');

    var coulScore = scoreSante >= 85 ? 'var(--vert,#1e7e34)' : (scoreSante >= 65 ? 'var(--ambre,#d97706)' : 'var(--rouge,#dc2626)');
    h += '<div class="bloc" style="margin-bottom:12px;padding:14px;background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:12px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">' +
        '<b>Santé globale de la base</b>' +
        '<b style="font-size:1.3rem;color:' + coulScore + '">' + scoreSante + ' %</b>' +
      '</div>' +
      '<div style="width:100%;height:10px;background:var(--trait,#e2e8f0);border-radius:5px;overflow:hidden">' +
        '<div style="width:' + scoreSante + '%;height:100%;background:' + coulScore + ';transition:width .3s"></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:0.8rem;color:var(--gris,#64748b)">' +
        '<span>' + conformes + ' conformes sur ' + total + '</span>' +
        '<span>' + (total - conformes) + ' point(s) à optimiser</span>' +
      '</div>' +
    '</div>';

    h += '<div class="kpis" style="margin-bottom:14px">' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="sansGps" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'sansGps' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (sansGps.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + sansGps.length + '</b>' +
        '<span>Sans GPS</span><small>Coordonnées vides ou 0</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="centroide" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'centroide' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (centroides.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + centroides.length + '</b>' +
        '<span>Centroïdes piégés</span><small>≥ 3 POI au même point</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="ecartGeo" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'ecartGeo' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (ecartGeo.length ? 'var(--ambre,#d97706)' : 'inherit') + '">' + ecartGeo.length + '</b>' +
        '<span>Écarts Quartier</span><small>> 8 km ou quartier NL</small></button>' +
      '<button type="button" class="kpi" data-a="auditFiltrer" data-v="horsCi" style="cursor:pointer;border:2px solid ' + (filtreAnomalie === 'horsCi' ? 'var(--primaire,#0A6C74)' : 'transparent') + '">' +
        '<b style="color:' + (horsCi.length ? 'var(--rouge,#dc2626)' : 'inherit') + '">' + horsCi.length + '</b>' +
        '<span>Hors Côte d\'Ivoire</span><small>Hors limites nationales</small></button>' +
    '</div>';

    var listeAffichable = [];
    if (filtreAnomalie === 'sansGps') listeAffichable = sansGps;
    else if (filtreAnomalie === 'centroide') listeAffichable = centroides;
    else if (filtreAnomalie === 'ecartGeo') listeAffichable = ecartGeo;
    else if (filtreAnomalie === 'horsCi') listeAffichable = horsCi;
    else if (filtreAnomalie === 'sansPresence') listeAffichable = sansPresence;
    else {
      listeAffichable = sansGps.concat(centroides).concat(ecartGeo).concat(horsCi).concat(sansPresence);
    }

    var titreFiltre = {
      tous: 'Toutes les anomalies détectées (' + listeAffichable.length + ')',
      sansGps: 'Établissements sans GPS (' + sansGps.length + ')',
      centroide: 'Pièges de centroïde (' + centroides.length + ')',
      ecartGeo: 'Incohérences de quartier / distance (' + ecartGeo.length + ')',
      horsCi: 'Coordonnées hors limites CI (' + horsCi.length + ')',
      sansPresence: 'Sans créneaux de visite (' + sansPresence.length + ')'
    }[filtreAnomalie] || 'Anomalies';

    h += '<div class="tete-bloc" style="display:flex;align-items:center;justify-content:space-between;margin:12px 0 8px">' +
      '<h3 style="margin:0;font-size:1rem">' + titreFiltre + '</h3>' +
      (filtreAnomalie !== 'tous' ? '<button type="button" class="bouton-texte" data-a="auditFiltrer" data-v="tous">Tout réafficher</button>' : '') +
      '</div>';

    if (!listeAffichable.length) {
      h += '<div class="vide" style="padding:20px 10px;text-align:center"><strong>✓ Aucune anomalie dans cette catégorie</strong>Toutes les fiches de ce groupe sont conformes.</div>';
    } else {
      h += '<ul class="liste liste-audit" style="display:flex;flex-direction:column;gap:8px;padding:0;margin:0;list-style:none">';
      listeAffichable.slice(0, 30).forEach(function (item) {
        var p = item.p, pr = item.pres || {};
        var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(p.code);
        var nomLieu = pr.lieu || p.nom || '';
        var quartierNom = pr.quartier || p.quartier || 'Quartier non renseigné';
        var communeNom = pr.commune || p.commune || '';
        h += '<li style="background:var(--papier,#fff);border:1px solid var(--trait,#e2e8f0);border-radius:10px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">' +
              '<b>' + esc(p.nom) + '</b>' +
              '<span class="etiquette ' + (estPh ? '' : 'ok') + '" style="font-size:0.75rem">' + (estPh ? 'Pharmacie' : esc(p.specialite || 'Médecin')) + '</span>' +
            '</div>' +
            '<div class="discret" style="font-size:0.8rem;margin-top:2px">' + esc(nomLieu) + (quartierNom ? ' · ' + esc(quartierNom) : '') + (communeNom ? ' (' + esc(communeNom) + ')' : '') + '</div>' +
            '<div style="color:var(--rouge,#dc2626);font-size:0.75rem;margin-top:4px;font-weight:600">⚠ ' + esc(item.motif) + '</div>' +
          '</div>' +
          '<button type="button" class="bouton petit bouton-plein" data-a="modifierFiche" data-v="' + esc(p.code) + '" style="white-space:nowrap">Corriger</button>' +
        '</li>';
      });
      h += '</ul>';
      if (listeAffichable.length > 30) {
        h += '<p class="discret" style="text-align:center;margin-top:10px">Affichage des 30 premières anomalies sur ' + listeAffichable.length + ' au total.</p>';
      }
    }

    return h;
  };

  VUES.bilan = function (integre) {
    var vueH = S.ui.statsVue === 'historique';
    var tete = (integre ? '' : '<h2 class="titre-vue">Bilan</h2>') +
      segment('Affichage', 'statsVue', [['tableau', 'Indicateurs'], ['historique', 'Historique']], vueH ? 'historique' : 'tableau') + barreQuiQuand('bilan');
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
      '<label class="interrupteur" style="margin-top:10px"><span>Compte rendu express<small class="discret bloc-texte">Saisie rapide des visites de routine sur un seul écran (statut, types, produits et prochain RDV). Le formulaire complet reste accessible d\'un clic.</small></span>' +
        '<input type="checkbox" data-f="crExpress"' + (c.crExpress ? ' checked' : '') + '></label>' +
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
    var sousType = f.type + (f.etape || '') + (f.choix ? '|choix' : '');
    var defil = el.querySelector('.feuille-corps'), haut = defil && el.dataset.type === sousType ? defil.scrollTop : 0;
    var nouvelle = !defil || el.dataset.ouverte !== f.type;
    el.dataset.type = sousType; el.dataset.ouverte = f.type;
    el.innerHTML = '<div class="voile" data-a="fermerFeuille"></div><div class="feuille' + (f.pleine ? ' pleine' : '') + (nouvelle ? ' anim' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(f.titre || '') + '">' +
      '<div class="poignee" aria-hidden="true"></div><div class="feuille-tete"><button type="button" class="retour-feuille" data-a="' + (f.retourAction || 'fermerFeuille') + '" aria-label="Retour">' + icone('chevron') + '</button><b>' + esc(f.titre || '') + '</b></div>' +
      '<div class="feuille-corps">' + contenu + '</div>' + (pied ? '<div class="feuille-pied">' + pied + '</div>' : '') + '</div>';
    if (haut) el.querySelector('.feuille-corps').scrollTop = haut;
    // 3.25.49 : Bande des produits fluide : centrage doux du produit sélectionné sans saut ni boucle
    var bp = el.querySelector('.bande-produits'), sel = bp && bp.querySelector('.bp-produit[aria-pressed="true"]');
    if (sel) {
      setTimeout(function () {
        var cible = sel.offsetLeft - (bp.clientWidth - sel.offsetWidth) / 2;
        if (nouvelle) {
          bp.scrollLeft = Math.max(0, cible);
        } else {
          bp.scrollTo({ left: Math.max(0, cible), behavior: 'smooth' });
        }
      }, 40);
    }
    initGlisseHorizontale();
    // 3.25.42 : Gestuelle swipe-down sur poignée/en-tête pour fermer au pouce
    var fEl = el.querySelector('.feuille');
    var poigneeEl = el.querySelector('.poignee');
    var teteEl = el.querySelector('.feuille-tete');
    if (fEl && (poigneeEl || teteEl)) {
      var yDep = 0, glisseY = 0, enGlisseFeuille = false;
      function debutGlisseF(e) {
        if (e.target.closest('button')) return;
        var pt = e.touches ? e.touches[0] : e;
        yDep = pt.clientY;
        glisseY = 0;
        enGlisseFeuille = true;
        fEl.classList.add('en-glisse-bas');
      }
      function bougeGlisseF(e) {
        if (!enGlisseFeuille) return;
        var pt = e.touches ? e.touches[0] : e;
        var dy = pt.clientY - yDep;
        if (dy > 0) {
          glisseY = dy;
          fEl.style.transform = 'translateY(' + dy + 'px)';
          if (e.cancelable) e.preventDefault();
        }
      }
      function finGlisseF() {
        if (!enGlisseFeuille) return;
        enGlisseFeuille = false;
        fEl.classList.remove('en-glisse-bas');
        if (glisseY > 75) {
          fEl.style.transform = '';
          ACTIONS.fermerFeuille();
        } else {
          fEl.style.transition = 'transform .2s ease';
          fEl.style.transform = 'translateY(0)';
          setTimeout(function () { if (fEl) fEl.style.transition = ''; }, 200);
        }
      }
      if (poigneeEl) {
        poigneeEl.addEventListener('touchstart', debutGlisseF, { passive: true });
        poigneeEl.addEventListener('touchmove', bougeGlisseF, { passive: false });
        poigneeEl.addEventListener('touchend', finGlisseF, { passive: true });
      }
      if (teteEl) {
        teteEl.addEventListener('touchstart', debutGlisseF, { passive: true });
        teteEl.addEventListener('touchmove', bougeGlisseF, { passive: false });
        teteEl.addEventListener('touchend', finGlisseF, { passive: true });
      }
    }
    gererHistoriqueModal(true);
  }
  // fiche d'un produit : l'essentiel ouvert (indications, contre-indications, arguments), le reste à déplier
  FEUILLES.ficheProduit = function (fe) {
    var f = fichesProduits().filter(function (x) { return x.produit === fe.produit; })[0]; if (!f) return '';
    var ouvertes = fe.ouvertes || {};
    var h = '<p class="fp-dci"><b>' + esc(f.dci) + '</b></p><p class="fiche-classe" style="margin-top:2px">' + esc(f.classe || '') + '</p>';
    SECTIONS_FICHE.forEach(function (sec) {
      var it = lignesFiche(f[sec[0]]);
      // 3.25.45 : Arguments clés — ajout en 1er point de la mention Prix indicatif (FCFA) et prise en charge CNAM / MUGEF-CI
      if (sec[0] === 'arguments') {
        var tarifStr = f.prix ? f.prix + ' FCFA' : (f.tarif || 'Tarif indicatif conventionné (FCFA)');
        var cnamStr = f.cnam || 'remboursable CNAM (70%)';
        var mugefStr = f.mugef || 'prise en charge MUGEF-CI';
        var ligneCI = 'Prix indicatif (' + tarifStr + ') et prise en charge ' + cnamStr + ' / ' + mugefStr;
        if (!it.some(function (x) { return x.indexOf('CNAM') >= 0 || x.indexOf('MUGEF') >= 0; })) {
          it = [ligneCI].concat(it);
        }
      }
      if (!it.length) return;
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
    // 3.25.49 : Bande des produits fluide au pouce (liste directe, sans saut ni duplication en boucle)
    var pied = '<div class="bande-produits" role="group" aria-label="Produits">' +
      ordre.map(function (n) {
        return '<button type="button" class="bp-produit" data-a="produitOuvrir" data-v="' + esc(n) + '" aria-pressed="' + (n === f.produit) + '">' + esc(n) + '</button>';
      }).join('') + '</div>';
    return { corps: h, pied: pied };
  };


  FEUILLES.communes = function (f) {
    var h = groupeChoix(f, { id: 'communes', titre: 'Communes & Secteurs', chemin: 'sel', multiple: true, sections: sectionsCommunes(), recherche: true, accordeon: 'communes',
      aide: f.cle === 'tout' ? 'Sélectionnez des communes entières ou des sous-secteurs précis (Abobo, Cocody, Yopougon). Aucune sélection = toutes les communes.' : 'Aucune sélection = les communes choisies pour la semaine.' });
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="communesToutes">Toutes</button><button class="bouton btn-secondaire" type="button" data-a="communesAucune">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="communesOk">' + (f.sel.length ? 'Valider (' + f.sel.length + ')' : 'Valider toutes') + '</button>' };
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
    var p = c.prat[f.code], dates = datesPeriode(), tAuj = aujourdhui();
    var options = [];
    dates.forEach(function (d) {
      var j = jourSemaineIndex(d);
      (c.parCode[f.code] || []).forEach(function (cr) { if (cr.jourIdx === j) options.push({ d: d, c: cr }); });
    });
    var defAuj = f.cle === '__aujourdhui' || !f.cle;
    h += '<p><b>' + esc(p.nom) + '</b> ' + etoiles(p.note) + '<span class="discret bloc-texte">' + esc(p.specialite) + '</span></p>';
    h += '<p class="discret">Quand planifier cette visite ?</p>';
    h += '<div class="choix-creneaux">' +
      '<label class="choix choix-aujourdhui"><input type="radio" name="impCle" value="__aujourdhui"' + (defAuj ? ' checked' : '') + '><span><b>Ajouter à aujourd\'hui (' + dateCourte(tAuj) + ')</b><small>Forcer dans la journée d\'aujourd\'hui, en dépit du programme</small></span></label>' +
      (options.length ? '<label class="choix"><input type="radio" name="impCle" value=""' + (!f.cle && !defAuj ? ' checked' : '') + '><span><b>Au meilleur moment</b><small>L\'application choisit le jour le plus pratique</small></span></label>' : '') +
      options.map(function (o) {
        var v = o.d + '|' + o.c.cle;
        return '<label class="choix"><input type="radio" name="impCle" value="' + esc(v) + '"' + (f.cle === v ? ' checked' : '') + '><span><b>' +
          majuscule(dateCourte(o.d)) + ', ' + o.c.creneau.toLowerCase() + ' ' + minutesVersHeure(o.c.debut) + '-' + minutesVersHeure(o.c.fin) + '</b><small>' +
          esc(o.c.lieu) + ', ' + esc(o.c.quartier) + '</small></span></label>';
      }).join('') + '</div>';
    if (!options.length) h += '<p class="discret">Aucune présence sur la période : vous pouvez néanmoins forcer l\'ajout à aujourd\'hui.</p>';
    h += '<label class="champ"><span>Heure de RDV (facultatif)</span><input type="time" id="impRdv" value="' + esc(f.rdv || '') + '"></label>' +
      '<div class="rangee"><button class="bouton" type="button" data-a="retourRecherche">Retour</button>' +
      '<button class="bouton bouton-plein" type="button" data-a="ajouterImpose">Ajouter</button></div>';
    return h;
  };

  FEUILLES.exporter = function (f) {
    var t = aujourdhui(), confirmes = datesPlan().filter(function (d) { return d >= t && jourConfirme(d); });
    if (confirmes.length <= 1) f.portee = 'jour';
    var dates = f.portee === 'jour' ? [S.ui.jour] : confirmes;
    var texte = texteProgramme(dates);
    f.texte = texte;
    var num = normaliserNumero(S.config.whatsapp);
    var corps = (confirmes.length > 1 ? '<div class="segment" role="group" aria-label="Contenu"><button type="button" data-a="exportPortee" data-v="jour" aria-pressed="' + (f.portee === 'jour') + '">Ce jour (' + dateCourte(S.ui.jour) + ')</button>' +
      '<button type="button" data-a="exportPortee" data-v="semaine" aria-pressed="' + (f.portee !== 'jour') + '">Tous (' + confirmes.length + ')</button></div>' : '') +
      '<pre class="apercu">' + esc(texte) + '</pre>' +
      (texte.length > 3500 ? '<p class="discret">Message long : préférez l\'envoi jour par jour.</p>' : '') +
      '<div class="rangee" style="margin-top:8px"><button class="bouton petit" type="button" data-a="copierTexte">Copier</button>' +
      (navigator.share ? '<button class="bouton petit" type="button" data-a="partagerTexte">Partager…</button>' : '') + '</div>' +
      (num ? '<p class="discret" style="margin-bottom:0">Vers +' + esc(num) + '</p>' : '');
    return {
      corps: corps,
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="retourExport">← Retour</button>' +
        '<button class="bouton" type="button" data-a="fermerFeuille">Fermer</button>' +
        '<button class="bouton bouton-plein wa" type="button" data-a="envoyerWhatsapp">' + icone('whatsapp') + 'Envoyer</button>'
    };
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

  FEUILLES.visitePlan = function (f) {
    var a = arret(f.uid);
    if (!a) return '<p class="discret">Visite introuvable.</p>';
    var sousTitre = estPharmacie(a) ? infosPharmaciePlan(a) : infosMedecinPlan(a);
    return '<div class="fiche-entete" style="margin-bottom:12px">' +
      '<span class="element-titre" style="font-size:1.15rem;display:flex;align-items:center;gap:6px">' + pastilleType(a) + '<b>' + esc(a.nom) + '</b> ' + etoiles(a.note) + '</span>' +
      (sousTitre ? '<p class="discret" style="margin:4px 0 8px">' + esc(sousTitre) + '</p>' : '') +
      '<p style="margin:0"><b>' + majuscule(dateLongue(a.date)) + '</b> · Passage vers <b>' + esc(a.heure || '--:--') + '</b> (' + esc(a.creneau || '') + ')</p>' +
      '</div>' +
      '<div class="choix-ajout">' +
        '<button type="button" class="tuile" data-a="planChangerJour" data-uid="' + a.uid + '"><b>' + icone('calendrier') + 'Changer de jour</b><small>Déplacer vers un autre jour ouvré</small></button>' +
        '<button type="button" class="tuile" data-a="completerJour" data-uid="' + a.uid + '"><b>' + icone('relancer') + 'Remplacer</b><small>Choisir un autre praticien pour ce créneau</small></button>' +
        '<button type="button" class="tuile" data-a="garderPlan" data-uid="' + a.uid + '"><b>' + icone('epingle') + (a.garde ? 'Ne plus garder' : 'Épingler / Garder') + '</b><small>' + (a.garde ? 'Actuellement protégé du recalcul' : 'Protéger ce praticien lors des recalculs') + '</small></button>' +
        '<button type="button" class="tuile" data-a="retirerPlan" data-uid="' + a.uid + '"><b>' + icone('fermer') + 'Retirer</b><small>Enlever de la tournée du ' + dateCourte(a.date) + '</small></button>' +
        '<button type="button" class="tuile" data-a="voirDansJournee" data-uid="' + a.uid + '"><b>' + icone('chevron') + 'Voir dans Journée</b><small>Basculer vers la vue détaillée du jour</small></button>' +
      '</div>';
  };

  function listeCandidatsRemplacementHtml(f, candidats, q) {
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var l = candidats;
    if (mots.length) {
      l = l.filter(function (x) {
        var p = x.cr.prat;
        var txt = normaliser([p.nom, p.specialite, x.cr.lieu, x.cr.quartier, x.cr.commune].join(' '));
        return mots.every(function (m) { return txt.indexOf(m) >= 0; });
      });
    }
    var a = arret(f.uid), phA = a && estPharmacie(a);
    if (!l.length) {
      return '<p class="discret" style="margin:12px 0">' + (mots.length ? 'Aucun ' + (phA ? 'établissement' : 'praticien') + ' ne correspond à « ' + esc(q) + ' ».' : 'Aucun' + (phA ? 'e autre pharmacie' : ' autre médecin') + ' disponible.') + '</p>';
    }
    return '<ul class="liste">' + l.map(function (x) {
      var p = x.cr.prat, ph = estPharmacie(p);
      return '<li><button type="button" class="element carte-bouton" data-a="remplacerChoisir" data-v="' + esc(x.cr.cle) + '" data-h="' + esc(x.heure) + '" data-dist="' + (x.dist !== undefined ? x.dist : '') + '" data-memelieu="' + (x.memeLieu ? '1' : '0') + '">' +
        '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + (ph ? '' : ' ' + etoiles(p.note)) + '</span>' +
        '<span class="discret bloc-texte">' + esc(infosSansDoublon(p, [ph ? '' : p.specialite, x.cr.lieu, x.cr.quartier])) + '</span>' +
        '<span class="discret bloc-texte">' + x.cr.creneau + ' ' + minutesVersHeure(x.cr.debut) + '-' + minutesVersHeure(x.cr.fin) + ' · passage vers ' + esc(x.heure) +
          (x.dist < 99 ? ' · ' + km(x.dist) + ' du lieu remplacé' : '') + '</span>' +
        '<span class="etiquettes">' + (x.memeLieu ? '<span class="etiquette ok">Même établissement</span>' : '') + (ph ? '' : badgeConv(p.conventionne)) + '<span class="etiquette">' + esc(vuDepuis(p.derniere, (a ? a.date : ''))) + '</span>' +
          (x.ok ? '' : '<span class="etiquette alerte">Horaire difficile à tenir</span>') + '</span></button></li>';
    }).join('') + '</ul>';
  }

  // 3.26.46 : Refonte visuelle de l'écran de confirmation de remplacement en cartes comparatives hiérarchisées
  function renduConfirmationRemplacement(f, a, x) {
    var phA = estPharmacie(a);
    var cr = Moteur.creneauParCle(ctx(), x.cle);
    var p = cr ? cr.prat : null;
    var phN = p ? estPharmacie(p) : phA;

    // 1. Visite initiale à remplacer
    var lieuInit = abregerHopital(a.lieu || lieuAffiche(a) || '');
    var secInit = nomSecteur(a.quartier, a.commune, a.coord);
    var specInit = (!phA && a.specialite) ? String(a.specialite).trim() : '';
    var statutInit = statutLibelle(a) || (a.etat === 'brouillon' ? 'Brouillon' : 'Planifiée');
    var heureInit = a.heure || '--:--';

    var pObjInit = (typeof praticien === 'function' && praticien(a.code)) || {};
    var lieuMatchInit = (pObjInit.lieux || []).filter(function (l) { return l.lieu === a.lieu; })[0] || (pObjInit.lieux && pObjInit.lieux[0]) || {};
    var repereInit = String(lieuMatchInit.adresse || lieuMatchInit.repere || pObjInit.adresse || pObjInit.repere || '').replace(/\bBoulevard\b/gi, 'Blvd.').trim();

    // 2. Nouveau praticien proposé
    var nomN = p ? p.nom : x.nom;
    var noteN = p ? p.note : x.note;
    var specN = (p && !phN && p.specialite) ? String(p.specialite).trim() : '';
    var convN = (p && !phN) ? p.conventionne : '';
    var lieuN = abregerHopital((cr && cr.lieu) || x.lieu || '');
    var secN = cr ? nomSecteur(cr.quartier, cr.commune, cr.coord) : (x.quartier || '');
    var lieuMatchN = (p && p.lieux || []).filter(function (l) { return l.lieu === (cr && cr.lieu); })[0] || (p && p.lieux && p.lieux[0]) || {};
    var repereN = String(lieuMatchN.adresse || lieuMatchN.repere || (p && (p.adresse || p.repere)) || '').replace(/\bBoulevard\b/gi, 'Blvd.').trim();
    var distN = (x.dist !== null && x.dist !== undefined && x.dist < 99) ? x.dist : null;
    var memeLieu = !!x.memeLieu || (cr && memeEtablissement(a.lieu || '', cr.lieu || ''));
    var heureN = x.heure || '--:--';
    var creneauN = cr ? cr.creneau : '';
    var horaireN = (cr && cr.debut && cr.fin) ? (minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin)) : '';

    var h = '<div class="rc-comparatif">';

    // CARTE 1 : VISITE INITIALE
    h += '<div class="rc-carte rc-carte-initiale">';
    h += '  <div class="rc-entete-carte">';
    h += '    <span class="rc-tag rc-tag-initiale">Visite initiale</span>';
    h += '    <span class="rc-badge-statut">' + esc(statutInit) + '</span>';
    h += '  </div>';
    h += '  <div class="rc-prat-ligne">';
    h += '    ' + pastilleType(a) + ' <strong class="rc-prat-nom">' + esc(a.nom) + '</strong>' + (!phA ? ' ' + etoiles(a.note) : '');
    h += '  </div>';
    if (specInit) {
      h += '  <div class="rc-spec-ligne"><span class="rc-spec-texte">' + esc(specInit) + '</span></div>';
    }
    h += '  <div class="rc-lieu-cadre">';
    h += '    <div class="rc-lieu-item rc-etablissement">🏥 <strong>' + esc(lieuInit || 'Établissement non précisé') + '</strong></div>';
    var secAffInit = [repereInit, (secInit && (!repereInit || repereInit.toLowerCase().indexOf(secInit.toLowerCase()) < 0) ? secInit : '')].filter(Boolean).join(' · ');
    if (secAffInit) {
      h += '    <div class="rc-lieu-item rc-secteur">📍 ' + esc(secAffInit) + '</div>';
    }
    h += '  </div>';
    h += '  <div class="rc-bas-carte">';
    h += '    <div class="rc-heure-initiale">⏰ Prévu vers <strong>' + esc(heureInit) + '</strong></div>';
    if (f.garder) {
      h += '    <div class="rc-note-cr rc-cr-conserve"><span class="rc-coche">✓</span> Compte rendu conservé dans l\'historique</div>';
    } else {
      h += '    <div class="rc-note-cr rc-cr-retire"><span class="rc-croix">✕</span> Retiré de la tournée du ' + dateCourte(a.date) + '</div>';
    }
    h += '  </div>';
    h += '</div>';

    // TRANSITION
    h += '<div class="rc-transition">';
    h += '  <div class="rc-transition-trait"></div>';
    h += '  <div class="rc-transition-pilule">';
    h += '    <span class="rc-transition-fleche">↓</span> <span class="rc-transition-texte">Remplacée par</span>';
    h += '  </div>';
    h += '  <div class="rc-transition-trait"></div>';
    h += '</div>';

    // CARTE 2 : NOUVEAU RENDEZ-VOUS
    h += '<div class="rc-carte rc-carte-nouveau">';
    h += '  <div class="rc-entete-carte">';
    h += '    <span class="rc-tag rc-tag-nouveau">Nouveau rendez-vous</span>';
    h += '    <span class="rc-badge-heure-nouveau">⏰ <strong>Passage vers ' + esc(heureN) + '</strong></span>';
    h += '  </div>';
    h += '  <div class="rc-prat-ligne">';
    h += '    ' + pastilleType(p || a) + ' <strong class="rc-prat-nom rc-nom-cible">' + esc(nomN) + '</strong>' + (!phN ? ' ' + etoiles(noteN) : '');
    h += '  </div>';
    if (specN || convN) {
      h += '  <div class="rc-spec-ligne">';
      if (specN) h += '<span class="rc-spec-texte">' + esc(specN) + '</span>';
      if (!phN && convN) h += ' ' + badgeConv(convN);
      h += '  </div>';
    }
    h += '  <div class="rc-lieu-cadre rc-cadre-cible">';
    h += '    <div class="rc-lieu-item rc-etablissement">🏥 <strong>' + esc(lieuN || 'Établissement non précisé') + '</strong></div>';
    var secAffN = [repereN, (secN && (!repereN || repereN.toLowerCase().indexOf(secN.toLowerCase()) < 0) ? secN : '')].filter(Boolean).join(' · ');
    if (secAffN) {
      h += '    <div class="rc-lieu-item rc-secteur">📍 ' + esc(secAffN) + '</div>';
    }
    if (creneauN || horaireN) {
      h += '    <div class="rc-lieu-item rc-creneau-texte">🕐 Présent ' + esc(creneauN) + (horaireN ? ' (' + esc(horaireN) + ')' : '') + '</div>';
    }
    if (memeLieu) {
      h += '    <div class="rc-proximite-box"><span class="etiquette ok">✓ Même établissement</span></div>';
    } else if (distN !== null) {
      h += '    <div class="rc-proximite-box"><span class="etiquette">🧭 ' + km(distN) + ' du lieu remplacé</span></div>';
    }
    h += '  </div>';
    h += '</div>';

    // ENCART REASSURANCE
    h += '<div class="rc-encart-info">';
    h += '  <span class="rc-info-icone">ℹ️</span>';
    h += '  <span class="rc-info-texte">L\'ordre de votre journée sera automatiquement réorganisé et optimisé pour intégrer ce rendez-vous sans détours.</span>';
    h += '</div>';

    h += '</div>';

    var pied = '<button type="button" class="bouton rc-btn-autre" data-a="remplacerNon">' +
      '<svg class="rc-chevron-gauche" viewBox="0 0 24 24" aria-hidden="true"><path d="m15 19-7-7 7-7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Choisir un autre</span>' +
      '</button>' +
      '<button type="button" class="bouton bouton-plein rc-btn-valider" data-a="remplacerOui">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Valider le remplacement</span>' +
      '</button>';

    return { corps: h, pied: pied };
  }

  FEUILLES.remplacer = function (f) {
    var a = arret(f.uid);
    if (!a) return '<p class="discret">Visite introuvable.</p>';
    var ph = estPharmacie(a);
    var libType = ph ? 'une pharmacie' : 'un médecin';
    if (f.choix) {
      f.retourAction = 'remplacerNon';
      return renduConfirmationRemplacement(f, a, f.choix);
    }
    f.retourAction = null;
    var l = candidatsRemplacement(a);
    if (!l.length) return '<p class="sous-titre" style="margin-top:0">Choisissez ' + libType + ' disponible pour rattraper et remplacer cette visite.</p>' +
      '<p class="discret">Aucun' + (ph ? 'e autre pharmacie' : ' autre médecin') + ' disponible ce jour-là selon vos critères (communes, collègues). Vous pouvez garder ' + esc(a.nom) + ' ou le retirer.</p>' +
      '<div class="rangee-actions" style="margin-top:16px;display:flex;gap:8px;flex-wrap:wrap">' +
        '<button type="button" class="bouton bouton-plein" data-a="feuilleFermer" style="flex:1;min-width:140px">' + icone('epingle') + 'Garder ' + esc(a.nom) + '</button>' +
        '<button type="button" class="bouton danger-doux" data-a="retirerPlan" data-uid="' + a.uid + '" style="flex:1;min-width:140px">' + icone('fermer') + 'Retirer de la tournée</button>' +
      '</div>';
    var q = f.q || '';
    return '<p class="sous-titre" style="margin-top:0">Choisissez ' + libType + ' disponible pour rattraper et remplacer <b>' + esc(a.nom) + '</b> dans votre tournée du ' + dateFr(a.date) + ' :</p>' +
      champRechercheLibre('rechRemplacer', q) +
      '<div id="resRemplacer" style="margin-top:8px">' + listeCandidatsRemplacementHtml(f, l, q) + '</div>';
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
    var filtre = filtreAjout(), dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
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
      var cr = x.cr, p = cr.prat, st = '';
      if (p.type === 'Pharmacie') {
        st = infosSansDoublon(p, [cr.lieu, cr.quartier, cr.commune]);
      } else {
        var hopital = abregerHopital(cr.lieu || (p.lieux && p.lieux[0] && p.lieux[0].lieu) || '');
        var secteur = cr.commune || p.commune || '';
        var m = [];
        if (p.specialite) m.push(p.specialite);
        if (hopital) m.push(hopital);
        if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) m.push(secteur);
        st = m.join(' · ');
      }
      return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
        '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
        (st ? '<span class="discret bloc-texte">' + esc(st) + '</span>' : '') +
        '<span class="discret bloc-texte">' + cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d)) + '</span></button></li>';
    }).join('') + '</ul>';
  }
  FEUILLES.ajouterTournee = function (f) {
    var rech = '';   // 3.25.3 : la recherche se fait dans la liste « Selon mes filtres »
    var t = S.ui.typeAjout, qui = t === 'Médecin' ? 'Médecins' : t === 'Pharmacie' ? 'Pharmacies' : 'Praticiens';
    var filtres = libelleFiltresRecherche(t);
    return rech + '<div class="choix-ajout">' + [['position', 'cible', 'Par ma position', qui + ' présents près de vous'],
      ['communes', 'filtre', 'Selon mes filtres', filtres]].map(function (x) {
      return '<button type="button" class="tuile" data-a="ajouterTourneeChoix" data-v="' + x[0] + '"><b>' + icone(x[1]) + esc(x[2]) + '</b><small>' + esc(x[3]) + '</small></button>';
    }).join('') + '</div>';
  };
  // 3.25.16 : + Médecin / + Pharmacie : « Selon mes filtres » = exactement les filtres de l'onglet Rechercher (communes comprises)
  function libelleFiltresRecherche(t) {
    var f = t ? filtresRechercheType(t) : S.ui.filtres, g = {};
    criteresActifs(f).forEach(function (x) { if (!t || x[0] !== 'type') (g[x[0]] = g[x[0]] || []).push(x[2]); });
    var l = ['type', 'communes', 'specialites', 'potentiels', 'visite', 'conv', 'equipe'].filter(function (k) { return g[k]; }).map(function (k) { return libelleListe(g[k], ''); });
    return l.length ? l.join(' · ') : 'Aucun filtre dans Répertoire : tous';
  }
  function communesAjout(d) { return (S.ui.filtres.communes || []).slice(); }
  // communes du jour : celles de la planification (par jour si réglé), sinon celles des visites déjà prévues
  function communesDuJour(d) {
    var l = communesPour(d) || [];
    if (!l.length) l = Array.from(new Set(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.commune; }).filter(Boolean)));
    return l;
  }
  // 3.25.2 : champ de recherche en tête, pour chercher parmi les praticiens déjà filtrés (communes du jour, critères)
  FEUILLES.ajouterCommunes = function (f) {
    var d = S.ui.dateAjout || S.ui.jour, com = Object.keys(ensemble(communesAjout(d))), q = (f && f.q) || '';
    return '<div class="rangee" style="justify-content:space-between;align-items:center;margin-bottom:6px"><span class="discret">Présents le ' + esc(dateCourte(d)) + (com.length ? ' · ' + esc(libelleCommunes(com)) : '') + '</span>' +
      '<button type="button" class="bouton petit" data-a="ajouterTourneeChoix" data-v="position">' + icone('cible') + 'Près de moi</button></div>' +
      champRechercheLibre('rechCommunes', q) + '<div id="resCommunes">' + resultatsCommunes(q) + '</div>';
  };
  function resultatsCommunes(q) {
    var d = S.ui.dateAjout || S.ui.jour, j = jourSemaineIndex(d), com = ensemble(communesAjout(d)), filtre = filtreAjout(), ex = exclusCollegues([d]);
    var mots = normaliser(q || '') ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    var dans = ensemble(S.plan.filter(function (a) { return a.date === d; }).map(function (a) { return a.code; })), vus = {};
    (ctx().parJour[j] || []).forEach(function (cr) {
      var p = cr.prat;
      if (dans[cr.code] || ex[cr.code] || (Object.keys(com).length && !(typeof communeCorrespondante === 'function' ? communeCorrespondante(cr, com) : com[cr.commune])) || (filtre && !filtre(p)) || absentLe(p, d)) return;
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
    if (!l.length) return '<p class="discret">' + (mots.length ? 'Aucun résultat pour « ' + esc(q) + ' » parmi ces praticiens.' : 'Aucun autre praticien présent ce jour-là' + (Object.keys(com).length ? ' dans ' + esc(libelleCommunes(Object.keys(com))) : '') + ', selon vos critères.') + '</p>';
    return (mots.length ? '<p class="discret">' + tous.length + ' résultat' + (tous.length > 1 ? 's' : '') + '.</p>' : '') +
      '<ul class="liste">' + l.map(function (x) {
        var cr = x.cr, p = cr.prat, st = '', details = cr.creneau + ' ' + minutesVersHeure(cr.debut) + '-' + minutesVersHeure(cr.fin) + ' · ' + esc(vuDepuis(p.derniere, d));
        if (p.type === 'Pharmacie') {
          st = infosSansDoublon(p, [cr.lieu, cr.quartier]);
          if (x.dist !== null && x.dist !== undefined) {
            details += ' · <b>' + (x.approx ? '≈ ' : '') + distanceCourte(x.dist) + '</b>' + (x.approx ? ' <small>(position du quartier)</small>' : '');
          }
        } else {
          var hopital = abregerHopital(cr.lieu || (p.lieux && p.lieux[0] && p.lieux[0].lieu) || '');
          var secteur = cr.commune || p.commune || '';
          var m = [];
          if (p.specialite) m.push(p.specialite);
          if (hopital) m.push(hopital);
          if (secteur && (!hopital || hopital.toLowerCase().indexOf(secteur.toLowerCase()) < 0)) m.push(secteur);
          st = m.join(' · ');
        }
        return '<li class="element' + classeType(p) + '"><button type="button" class="carte-bouton" data-a="ajouterCandidat" data-r="recherche" data-v="' + esc(cr.cle) + '">' +
          '<span class="element-titre">' + pastilleType(p) + esc(p.nom) + ' ' + etoiles(p.note) + '</span>' +
          (st ? '<span class="discret bloc-texte">' + esc(st) + '</span>' : '') +
          '<span class="discret bloc-texte">' + details + '</span></button></li>';
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
      pied: piedQuestion('data-a="confirmerOui"', esc(f.oui), 'confirmerNon', f.ouiClasse) };
  };

  FEUILLES.choixAccepter = function (f) {
    var d = f.jour || S.ui.jour, b = f.jours || joursBrouillon();
    return {
      corps: '<p style="margin:0">Confirmer uniquement le <b>' + esc(dateCourte(d)) + '</b> ou les <b>' + b.length + ' jours</b> en brouillon ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">← Retour</button>' +
        '<button class="bouton" type="button" data-a="accepterPortee" data-v="jour">Ce jour</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="accepterPortee" data-v="tous">' + icone('valider') + 'Les ' + b.length + ' jours</button>'
    };
  };

  FEUILLES.refusProgramme = function () {
    var d = S.ui.aAccepter || S.ui.jour, aSauve = S.ui.avantTirage && S.ui.avantTirage.date === d;
    return {
      corps: '<p style="margin:0">Que faire pour le <b>' + esc(dateCourte(d)) + '</b> ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">← Retour</button>' +
        '<button class="bouton" type="button" data-a="recalculerEncore">' + icone('relancer') + 'Recalculer</button>' +
        (aSauve ? '<button class="bouton bouton-plein" type="button" data-a="restaurerAvantTirage">↩ Liste précédente</button>' :
          '<button class="bouton bouton-plein" type="button" data-a="continuerModifier">' + icone('crayon') + 'Modifier</button>')
    };
  };
  FEUILLES.valide = function (f) {
    var l = f.dates || [];
    return {
      corps: '<p style="margin:0"><b>' + (l.length === 1 ? majuscule(dateCourte(l[0])) + ' confirmé' : l.length + ' jours confirmés') +
        '</b> (visible par l\'équipe). Partager sur WhatsApp ?</p>',
      pied: '<button class="bouton-texte sortir-question" type="button" data-a="annulerConfirmation">← Retour</button>' +
        '<button class="bouton" type="button" data-a="fermerFeuille">Non</button>' +
        '<button class="bouton bouton-plein wa" type="button" data-a="ouvrirExport">' + icone('whatsapp') + 'Envoyer</button>'
    };
  };

  // 3.26.19 : Sélecteur sécurisé de l'établissement pour la capture GPS d'un praticien multi-sites
  FEUILLES.choixLieuGps = function (f) {
    var code = f.code, d = f.d || brouillonFiche(code);
    var p = praticien(code) || {};
    var lieux = Array.isArray(d.lieux) ? d.lieux : [];
    var h = '<div class="boite-contenu pad">' +
      '<div class="alerte info" style="margin-bottom:14px;border-left:4px solid var(--primaire,#0A6C74);background:rgba(10,108,116,0.08);padding:12px;border-radius:8px;font-size:13.5px;line-height:1.45">' +
        '<div style="font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:6px">' + icone('cible') + ' Praticien multi-sites</div>' +
        'Le Dr <b>' + esc(p.nom || d.nom) + '</b> consulte dans plusieurs établissements. ' +
        'Touchez l\'établissement où <b>vous êtes physiquement présent</b> pour enregistrer son GPS sans écraser les autres :' +
      '</div>' +
      '<div class="liste-choix-lieux-gps" style="display:flex;flex-direction:column;gap:10px">';

    lieux.forEach(function (l, idx) {
      var aGps = l.lat && l.lon && isFinite(+String(l.lat).replace(',', '.')) && +String(l.lat).replace(',', '.') !== 0;
      var coordStr = aGps ? (+String(l.lat).replace(',', '.')).toFixed(5) + ', ' + (+String(l.lon).replace(',', '.')).toFixed(5) : '';
      h += '<div class="carte-choix-gps" style="border:1.5px solid ' + (aGps ? 'var(--trait,#d0d7de)' : 'rgba(230,126,34,0.5)') + ';border-radius:10px;padding:12px;background:var(--fond-carte,#fff);box-shadow:0 1px 3px rgba(0,0,0,0.05)">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:6px">' +
          '<div style="flex:1">' +
            '<div style="font-weight:700;font-size:15px;color:var(--encre,#1c2833)">' + esc(l.lieu || ('Établissement ' + (idx + 1))) + '</div>' +
            '<div style="font-size:13px;color:var(--gris,#566573);margin-top:2px">' +
              esc(l.quartier || 'Quartier non renseigné') + (l.commune ? ' · ' + esc(l.commune) : '') +
            '</div>' +
          '</div>' +
          '<span class="gps-ici-badge ' + (aGps ? 'fixe' : 'manquant') + '" style="font-size:11.5px;padding:3px 8px;border-radius:8px;white-space:nowrap">' +
            (aGps ? '✓ Fixé' : 'Non fixé') +
          '</span>' +
        '</div>' +
        (aGps ? '<div style="font-size:11.5px;color:var(--gris,#7f8c8d);margin-bottom:10px">Coordonnées actuelles : ' + esc(coordStr) + '</div>' : '<div style="height:6px"></div>') +
        '<button type="button" class="bouton bouton-plein bouton-large" data-a="capterGpsLieu" data-v="' + esc(code) + '" data-i="' + idx + '" style="width:100%;display:flex;justify-content:center;align-items:center;gap:6px">' +
          icone('cible') + '<span>Capter le GPS de ce lieu</span>' +
        '</button>' +
      '</div>';
    });

    h += '</div>' +
      '<div style="margin-top:14px;text-align:center">' +
        '<button type="button" class="bouton" data-a="fermerFeuille">Annuler</button>' +
      '</div>' +
    '</div>';
    return h;
  };

  // Choix multiple générique (spécialités ciblées par la tournée)
  FEUILLES.multi = function (f) {
    if (f.cle === 'specialites') {
      var coeur = coeurDeCible(), sel = f.sel || [], q = normaliser((f.q && f.q.multi) || '');
      var coeurMap = {}, coeurOpts = [], autresOpts = [];
      coeur.forEach(function (nom) { coeurMap[nom] = true; });
      sel.forEach(function (nom) { coeurMap[nom] = true; });
      f.options.forEach(function (o) {
        if (coeurMap[o.nom]) coeurOpts.push(o);
        else autresOpts.push(o);
      });
      function puceM(o) {
        var actif = sel.indexOf(o.nom) >= 0;
        return '<button type="button" class="puce" data-a="multiToggle" data-v="' + esc(o.nom) +
          '" data-lib="' + esc(normaliser(o.nom)) + '" aria-pressed="' + actif + '"' + (q && normaliser(o.nom).indexOf(q) < 0 ? ' hidden' : '') + '>' +
          esc(o.nom) + (o.n !== undefined ? '<small>' + o.n + '</small>' : '') + '</button>';
      }
      var total = sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
      var h = '<div class="groupe-filtre ouvert" data-groupe="multi">';
      if (f.aide) h += '<p class="discret groupe-aide" style="margin-top:0">' + esc(f.aide) + '</p>';
      h += '<div class="recherche recherche-large">' + icone('loupe') + '<input type="search" data-f="chercheOption" data-g="multi" placeholder="Rechercher une spécialité…" value="' +
        esc((f.q && f.q.multi) || '') + '" aria-label="Rechercher une spécialité"></div>';
      h += '<div class="sous-titre-zone" style="margin:10px 0 6px"><span>Cœur de cible & sélectionnées (' + coeurOpts.length + ')</span></div>' +
        '<div class="puces">' + coeurOpts.map(puceM).join('') + '</div>';
      if (autresOpts.length) {
        var ouv = !!(f.autresOuvert || q);
        h += '<div class="section-choix" style="margin-top:14px">' +
          '<button type="button" class="aire-titre aire-bascule" data-a="multiToggleAutres" aria-expanded="' + ouv + '"><span>Autres spécialités</span><small>' + autresOpts.length + '</small>' + icone('chevron') + '</button>' +
          '<div class="puces" id="autresSpecs" data-ferme="1"' + (!ouv ? ' hidden' : '') + '>' + autresOpts.map(puceM).join('') + '</div></div>';
      }
      h += '</div>';
      return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="multiTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="multiAucun">Effacer</button>' +
        '<button class="bouton bouton-plein btn-valider" type="button" data-a="multiOk">' + (sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
    }
    var h = groupeChoix(f, { id: 'multi', titre: f.titreGroupe || 'Choix', chemin: 'sel', multiple: true, recherche: f.options.length > 8, aide: f.aide,
      options: f.options.map(function (o) { return { v: o.nom, lib: o.nom, n: o.n }; }) });
    var total = f.sel.reduce(function (s2, v) { var o = f.options.filter(function (x) { return x.nom === v; })[0]; return s2 + (o && o.n ? o.n : 0); }, 0);
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="multiTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="multiAucun">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="multiOk">' + (f.sel.length ? 'Valider · ' + total + ' médecin' + (total > 1 ? 's' : '') : 'Valider · toutes') + '</button>' };
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
    var o = { id: 'l', titre: 'Un seul choix', chemin: 'sel', recherche: true, accordeon: String(f.id).replace(/\d+$/, '') };
    if (cfg.sections) o.sections = cfg.sections.map(function (x) { return { titre: x.titre, options: map(x.options), fermeeParDefaut: !!x.fermeeParDefaut }; }); else o.options = map(cfg.options || []);
    if (n <= 8) o.recherche = false;
    return groupeChoix(f, o);
  };
  FEUILLES.crListe = function (f) {
    var estProd = f.cle === 'produits' || f.cle === 'besoin' || f.cle === 'actionProduits';
    var o = { id: 'l', titre: f.multi ? 'Plusieurs choix possibles' : 'Un seul choix', chemin: 'sel', multiple: f.multi, recherche: f.options.length > 8 };
    if (estProd) {
      var g = produitsParGamme();
      o.sections = [
        { titre: 'Gamme A (Zyltan, Lesstrol, Eurythmic, Tensicard)', options: g.gammeA.map(function (p) { return { v: p, lib: p }; }) },
        { titre: 'Gamme B (autres produits)', options: g.gammeB.map(function (p) { return { v: p, lib: p }; }) }
      ];
    } else {
      o.options = f.options.map(function (op) { return { v: op[0], lib: op[1] }; });
    }
    var h = groupeChoix(f, o);
    return f.multi ? { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="crListeTous">Tous</button><button class="bouton btn-secondaire" type="button" data-a="crListeAucun">Effacer</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="crListeOk">Valider' + (f.sel.length ? ' · ' + f.sel.length : '') + '</button>' } : h;
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
      com: groupeChoix(f, { id: 'com', titre: 'Communes', chemin: 'brouillon.communes', multiple: true, repliable: !seule, recherche: true, resume: 'Toutes', sections: sectionsCommunes(), accordeon: 'com',
        aide: 'Lieux d\'exercice du praticien. Pour un établissement ou un quartier, utilisez la recherche de la liste.' }),
      valeur: groupeChoix(f, { id: 'pot', titre: 'Potentiel de prescription', chemin: 'brouillon.potentiels', multiple: true, tousVide: true,
          options: opt([['A', '★★★'], ['B', '★★'], ['C', '★']]) }) +
        groupeChoix(f, { id: 'conv', titre: 'Engagé', chemin: 'brouillon.conv', options: opt([['tous', 'Tous'], ['oui', 'Oui'], ['non', 'Non']]) }),
      suivi: groupeChoix(f, { id: 'visite', titre: 'Dernière visite (un seul choix)', chemin: 'brouillon.visite', options: opt([['tous', 'Toutes'], ['recent', 'Visité -30 j'],
          ['30', 'Non visité +30 j'], ['jamais', 'Jamais visité'], ['retard', 'En retard'], ['revoir', 'À revoir']]) }) +
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
    return { corps: h, pied: '<button class="bouton btn-secondaire" type="button" data-a="filtresReinit">' + (seule ? 'Effacer' : 'Tout effacer') + '</button>' +
      '<button class="bouton bouton-plein btn-valider" type="button" data-a="filtresOk">' + libOk + '</button>' };
  };

  // ------------------------------------------------------------------ Fiche praticien : parcours 2 étapes (Profil & GPS / Jours & horaires)
  var ETAPES_FICHE = ['1. Profil & GPS', '2. Jours & horaires'];
  // 3.25.23 : détection anti-doublon intelligente (ignore Dr/Pr/Pharmacie/Officine, vérifie mots-clés et téléphone)
  function nomCleDoublon(s) {
    return normaliser(s || '').replace(/\b(dr|docteur|pr|prof|professeur|mr|mme|mlle|pharmacie|grande|nouvelle|officine|clinique|cabinet|centre|medical|hopital|chu|chr|pmi|de|du|des|la|le|les|d|l)\b/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function chercherDoublonsFiche(d) {
    if (!d) return [];
    var nomBrut = normaliser(d.nom || ''), cle = nomCleDoublon(d.nom || '');
    var mots = cle ? cle.split(' ').filter(function (w) { return w.length >= 3; }) : [];
    var tel = normaliserNumero(d.telephone || '');
    if (cle.length < 3 && !tel) return [];
    var c = ctx(), res = [];
    ((S.data && S.data.praticiens) || []).forEach(function (p) {
      if (d.code && p.code === d.code) return;
      var pNom = normaliser(p.nom || ''), pCle = nomCleDoublon(p.nom || '');
      var pMots = pCle ? pCle.split(' ').filter(function (w) { return w.length >= 3; }) : [];
      var pTel = normaliserNumero(p.telephone || '');
      var memeTel = !!(tel && pTel && tel === pTel);
      var exact = (nomBrut.length >= 3 && pNom === nomBrut) || (cle.length >= 3 && pCle === cle);
      var proche = false;
      if (!exact && mots.length && pMots.length) {
        var communs = mots.filter(function (w) { return pCle.indexOf(w) >= 0; });
        proche = (communs.length === mots.length && cle.length >= 4) || (mots.length >= 2 && communs.length >= 2);
      }
      if (!exact && !memeTel && !proche) return;
      var lieux = (c.presencesParCode[p.code] || []).map(function (x) { return [x.lieu, x.quartier, x.commune].filter(Boolean).join(', '); }).filter(Boolean);
      res.push({ p: p, exact: exact || memeTel, memeTel: memeTel, memeType: (p.type === 'Pharmacie') === (d.type === 'Pharmacie'), lieu: lieux[0] || '' });
    });
    res.sort(function (a, b) { return (b.exact - a.exact) || (b.memeType - a.memeType); });
    return res.slice(0, 4);
  }
  function rendreDoublonsFiche(d) {
    var l = chercherDoublonsFiche(d);
    if (!l.length) return '';
    return '<div class="bandeau" style="margin:6px 0 10px"><p style="margin:0 0 6px"><b>Déjà dans la base (' + l.length + ') :</b> touchez pour ouvrir la fiche existante et éviter un doublon.</p>' +
      '<ul class="sug-liste">' + l.map(function (x) {
        var p = x.p;
        return '<li><button type="button" data-a="ouvrirDoublon" data-v="' + esc(p.code) + '"><b>' + esc(p.nom) + ' ' + etoiles(p.note) + '</b><small>' +
          esc([p.specialite, x.lieu, p.telephone].filter(Boolean).join(' · ')) + (x.memeTel ? ' · Même téléphone' : '') + ' — <u>Ouvrir cette fiche</u></small></button></li>';
      }).join('') + '</ul></div>';
  }
  // 3.25.5 : saisie assistée de l'établissement : dès quelques lettres, les établissements déjà connus de la base
  // (lieu, quartier, commune), pour reprendre exactement le même nom et éviter les doublons mal orthographiés
  // 3.25.33 : Hôpitaux et cliniques connus (les pharmacies sont formellement exclues)
  var HOPITAUX_DEFAUT = [
    { lieu: 'CHU de Cocody', quartier: 'Cocody Centre', commune: 'Cocody', lat: 5.344603, lon: -3.994502 },
    { lieu: 'CHU de Treichville', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293486, lon: -4.003767 },
    { lieu: 'CHU d\'Angré', quartier: 'Angré', commune: 'Cocody', lat: 5.405000, lon: -3.978000 },
    { lieu: 'PISAM (Polyclinique Sainte Anne-Marie)', quartier: 'Vieux Cocody', commune: 'Cocody', lat: 5.336512, lon: -4.013281 },
    { lieu: 'Clinique Farah', quartier: 'Marcory Residentiel', commune: 'Marcory', lat: 5.304000, lon: -3.987000 },
    { lieu: 'Polyclinique des Deux Plateaux', quartier: 'Deux Plateaux', commune: 'Cocody', lat: 5.362868, lon: -3.997261 },
    { lieu: 'Hôpital Militaire d\'Abidjan (HMA)', quartier: 'Paillet', commune: 'Adjamé', lat: 5.381168, lon: -4.007937 },
    { lieu: 'Hôpital Général de Yopougon-Attié', quartier: 'Attié', commune: 'Yopougon', lat: 5.342066, lon: -4.080122 },
    { lieu: 'Hôpital Général de Marcory', quartier: 'Marcory Centre', commune: 'Marcory', lat: 5.301297, lon: -3.983410 },
    { lieu: 'CHR d\'Abobo', quartier: 'Abobo Nord', commune: 'Abobo', lat: 5.433023, lon: -4.038858 },
    { lieu: 'Institut de Cardiologie d\'Abidjan (ICA)', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293007, lon: -4.005949 }
  ];

  // 3.25.34 : Dictionnaire canonique pour corriger automatiquement les fautes, abréviations et éviter les doublons en BDD
  var CANONICAL_HOPITAUX = [
    { re: /^(chu\b.*cocody|centre.*hospitalier.*universitaire.*cocody|cocody\s*chip)/i, nom: 'CHU de Cocody', quartier: 'Cocody Centre', commune: 'Cocody', lat: 5.344603, lon: -3.994502 },
    { re: /^(chu\b.*treichville|centre.*hospitalier.*universitaire.*treichville)/i, nom: 'CHU de Treichville', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293486, lon: -4.003767 },
    { re: /^(chu\b.*angr[eé]|centre.*hospitalier.*universitaire.*angr[eé])/i, nom: 'CHU d\'Angré', quartier: 'Angré', commune: 'Cocody', lat: 5.405000, lon: -3.978000 },
    { re: /^(pisam\b|p\.i\.s\.a\.m|polyclinique.*sainte.*anne.*marie|poly.*ste.*anne.*marie)/i, nom: 'PISAM (Polyclinique Sainte Anne-Marie)', quartier: 'Vieux Cocody', commune: 'Cocody', lat: 5.336512, lon: -4.013281 },
    { re: /^(farah\b|clinique.*farah)/i, nom: 'Clinique Farah', quartier: 'Marcory Residentiel', commune: 'Marcory', lat: 5.304000, lon: -3.987000 },
    { re: /^(hma\b|h\.m\.a|h[oô]pital.*militaire.*abidjan|h[oô]pital.*militaire)/i, nom: 'Hôpital Militaire d\'Abidjan (HMA)', quartier: 'Paillet', commune: 'Adjamé', lat: 5.381168, lon: -4.007937 },
    { re: /^(ica\b|i\.c\.a|institut.*de.*cardiologie)/i, nom: 'Institut de Cardiologie d\'Abidjan (ICA)', quartier: 'Zone 3 (CHU)', commune: 'Treichville', lat: 5.293007, lon: -4.005949 },
    { re: /^(hg\b.*yopougon|h[oô]pital.*g[eé]n[eé]ral.*yopougon|h[oô]pital.*g[eé]n[eé]ral.*atti[eé]|hg.*atti[eé])/i, nom: 'Hôpital Général de Yopougon-Attié', quartier: 'Attié', commune: 'Yopougon', lat: 5.342066, lon: -4.080122 },
    { re: /^(hg\b.*marcory|h[oô]pital.*g[eé]n[eé]ral.*marcory)/i, nom: 'Hôpital Général de Marcory', quartier: 'Marcory Centre', commune: 'Marcory', lat: 5.301297, lon: -3.983410 },
    { re: /^(chr\b.*abobo|h[oô]pital.*abobo|h[oô]pital.*g[eé]n[eé]ral.*abobo)/i, nom: 'CHR d\'Abobo', quartier: 'Abobo Nord', commune: 'Abobo', lat: 5.433023, lon: -4.038858 },
    { re: /^(hg\b.*koumassi|h[oô]pital.*g[eé]n[eé]ral.*koumassi)/i, nom: 'Hôpital Général de Koumassi', quartier: 'Koumassi Centre', commune: 'Koumassi', lat: 5.305600, lon: -3.953400 },
    { re: /^(hg\b.*port.*bou[eë]t|h[oô]pital.*g[eé]n[eé]ral.*port.*bou[eë]t)/i, nom: 'Hôpital Général de Port-Bouët', quartier: 'Port-Bouët Centre', commune: 'Port-Bouët', lat: 5.261200, lon: -3.948000 },
    { re: /^(hg\b.*adjam[eé]|h[oô]pital.*g[eé]n[eé]ral.*adjam[eé])/i, nom: 'Hôpital Général d\'Adjamé', quartier: 'Adjamé 220 Logements', commune: 'Adjamé', lat: 5.356200, lon: -4.026800 },
    { re: /^(hg\b.*bingerville|h[oô]pital.*g[eé]n[eé]ral.*bingerville)/i, nom: 'Hôpital Général de Bingerville', quartier: 'Bingerville', commune: 'Bingerville', lat: 5.358000, lon: -3.889000 },
    { re: /^(poly.*deux.*plateaux|poly.*2.*plateaux|polyclinique.*deux.*plateaux|polyclinique.*2.*plateaux)/i, nom: 'Polyclinique des Deux Plateaux', quartier: 'Deux Plateaux', commune: 'Cocody', lat: 5.362868, lon: -3.997261 },
    { re: /^(poly.*plateau\b|polyclinique.*plateau)/i, nom: 'Polyclinique du Plateau', quartier: 'Plateau', commune: 'Plateau', lat: 5.327500, lon: -4.021000 },
    { re: /^(clinique.*saint.*viateur|clinique.*st.*viateur)/i, nom: 'Clinique Saint Viateur', quartier: 'Palmeraie', commune: 'Cocody', lat: 5.372500, lon: -3.958000 },
    { re: /^(clinique.*les.*rosiers|clinique.*rosiers)/i, nom: 'Clinique Les Rosiers', quartier: 'Zone 4', commune: 'Marcory', lat: 5.292000, lon: -3.985000 },
    { re: /^(clinique.*danga|clinique.*m[eé]dicale.*danga)/i, nom: 'Clinique Médicale Danga', quartier: 'Danga', commune: 'Cocody', lat: 5.341200, lon: -4.008900 }
  ];

  function canonicaliserEtablissement(nomSaisi, quartierSaisi, communeSaisie) {
    var raw = String(nomSaisi || '').trim();
    if (!raw) return null;
    var norm = normaliser(raw);

    // 1. Dictionnaire canonique des grands centres de santé
    for (var i = 0; i < CANONICAL_HOPITAUX.length; i++) {
      var h = CANONICAL_HOPITAUX[i];
      if (h.re.test(raw) || h.re.test(norm)) {
        return { lieu: h.nom, quartier: h.quartier, commune: h.commune, lat: h.lat, lon: h.lon };
      }
    }

    // 2. Table de référence officielle des établissements de Côte d'Ivoire (175 établissements)
    if (typeof TABLE_REFERENCE_ETABLISSEMENTS_CI !== 'undefined') {
      if (TABLE_REFERENCE_ETABLISSEMENTS_CI[norm]) {
        var tr = TABLE_REFERENCE_ETABLISSEMENTS_CI[norm];
        return {
          lieu: tr.titre || raw,
          quartier: tr.quartier || quartierSaisi || '',
          commune: tr.commune || communeSaisie || '',
          lat: tr.lat || '',
          lon: tr.lon || ''
        };
      }
      var tKeys = Object.keys(TABLE_REFERENCE_ETABLISSEMENTS_CI);
      for (var k = 0; k < tKeys.length; k++) {
        var tk = tKeys[k];
        if (norm.length >= 4 && (tk === norm || (tk.indexOf(norm) >= 0 && tk.length >= 5) || (norm.indexOf(tk) >= 0 && norm.length >= 5))) {
          var trk = TABLE_REFERENCE_ETABLISSEMENTS_CI[tk];
          return {
            lieu: trk.titre || raw,
            quartier: trk.quartier || quartierSaisi || '',
            commune: trk.commune || communeSaisie || '',
            lat: trk.lat || '',
            lon: trk.lon || ''
          };
        }
      }
    }

    // 3. Établissements connus de la BDD (mutualisation pour éviter fautes & doublons)
    var connus = etablissementsConnus();
    for (var j = 0; j < connus.length; j++) {
      var e = connus[j];
      var ne = normaliser(e.lieu);
      if (norm === ne || (norm.length >= 4 && (norm.indexOf(ne) >= 0 || ne.indexOf(norm) >= 0))) {
        return {
          lieu: e.lieu,
          quartier: e.quartier || quartierSaisi || '',
          commune: e.commune || communeSaisie || '',
          lat: e.lat || '',
          lon: e.lon || ''
        };
      }
    }
    return null;
  }

  function trouverEtablissementBDD(nomSaisi, quartierSaisi, communeSaisie) {
    var raw = String(nomSaisi || '').trim();
    if (!raw || raw.length < 2) return null;
    var norm = normaliser(raw);

    // 1. Dictionnaire canonique et table de référence
    var can = canonicaliserEtablissement(raw, quartierSaisi, communeSaisie);
    if (can && can.quartier && !/^NL$/i.test(can.quartier)) return can;

    // 2. Établissements connus en BDD
    var connus = etablissementsConnus();
    for (var j = 0; j < connus.length; j++) {
      var e = connus[j];
      var ne = normaliser(e.lieu || '');
      if (ne && (ne === norm || (norm.length >= 4 && (ne.indexOf(norm) >= 0 || norm.indexOf(ne) >= 0)))) {
        if (e.quartier && !/^NL$/i.test(e.quartier)) {
          return {
            lieu: e.lieu,
            quartier: e.quartier,
            commune: e.commune || communeSaisie || '',
            lat: e.lat || '',
            lon: e.lon || ''
          };
        }
      }
    }

    // 3. Lieux réels de présence
    var pres = (S.data && S.data.presences) || [];
    for (var p = 0; p < pres.length; p++) {
      var pr = pres[p];
      var np = normaliser(pr.lieu || '');
      if (np && (np === norm || (norm.length >= 4 && (np.indexOf(norm) >= 0 || norm.indexOf(np) >= 0)))) {
        if (pr.quartier && !/^NL$/i.test(pr.quartier)) {
          return {
            lieu: pr.lieu,
            quartier: pr.quartier,
            commune: pr.commune || communeSaisie || '',
            lat: pr.lat || '',
            lon: pr.lon || ''
          };
        }
      }
    }
    return null;
  }

  function etablissementsConnus() {
    var vus = {}, l = [];
    var pharCodes = {};
    ((S.data && S.data.praticiens) || []).forEach(function (p) {
      if (p.type === 'Pharmacie' || /^PHA-/i.test(p.code)) pharCodes[p.code] = true;
    });

    // 1. Établissements centralisés de la BDD (onglet Etablissements)
    ((S.data && S.data.etablissements) || []).forEach(function (et) {
      var nom = String(et.nom || '').trim(); if (!nom) return;
      var k = normaliser(nom);
      var la = parseFloat(String(et.lat || '').replace(',', '.')), lo = parseFloat(String(et.lon || '').replace(',', '.'));
      vus[k] = {
        code: et.code || '',
        lieu: nom,
        categorie: et.categorie || '',
        quartier: et.quartier || '',
        commune: et.commune || '',
        zone: et.zone || '',
        lat: isFinite(la) ? la : '',
        lon: isFinite(lo) ? lo : '',
        telephone: et.telephone || '',
        reperes: et.reperes || '',
        n: 0,
        txt: normaliser(nom + ' ' + (et.quartier || '') + ' ' + (et.commune || '') + ' ' + (et.categorie || ''))
      };
      l.push(vus[k]);
    });

    // 2. Pré-remplir avec les hôpitaux de référence si non déjà présents
    HOPITAUX_DEFAUT.forEach(function (h) {
      var k = normaliser(h.lieu);
      if (!vus[k]) {
        vus[k] = { code: '', lieu: h.lieu, categorie: 'Hôpital', quartier: h.quartier, commune: h.commune, lat: h.lat, lon: h.lon, n: 1, txt: normaliser(h.lieu + ' ' + h.quartier + ' ' + h.commune) };
        l.push(vus[k]);
      }
    });

    // 3. Compléter avec les présences réelles et compter le nombre de praticiens
    ((S.data && S.data.presences) || []).forEach(function (x) {
      var nom = String(x.lieu || '').trim(); if (!nom || /^NL$/i.test(nom)) return;
      if (pharCodes[x.code] || /^PHA-/i.test(x.code) || /^(pharmacie|phcie|grande pharmacie|nouvelle pharmacie)\b/i.test(nom)) return;
      var k = normaliser(nom), e = vus[k];
      if (!e) { e = vus[k] = { code: '', lieu: nom, categorie: '', quartier: '', commune: '', lat: '', lon: '', n: 0, txt: k }; l.push(e); }
      e.n++;
      if (!e.quartier && x.quartier && !/^NL$/i.test(x.quartier)) e.quartier = x.quartier;
      if (!e.commune && x.commune) e.commune = x.commune;
      var la = parseFloat(String(x.lat).replace(',', '.')), lo = parseFloat(String(x.lon).replace(',', '.'));
      if (!e.lat && isFinite(la) && isFinite(lo) && la) { e.lat = la; e.lon = lo; }
    });
    l.forEach(function (e) { e.txt = normaliser(e.lieu + ' ' + (e.quartier || '') + ' ' + (e.commune || '') + ' ' + (e.categorie || '')); });
    return l;
  }
  function suggestionsLieu(q, i) {
    var t = normaliser(q || ''), mots = t ? sansAccents(q).toLowerCase().split(/\s+/).map(normaliser).filter(Boolean) : [];
    S.ui.sugLieux = S.ui.sugLieux || {}; S.ui.sugLieux[i] = [];
    var tous = etablissementsConnus();

    // 3.25.32 : Tri intelligent par proximité géographique (position GPS du délégué en priorité, sinon son quartier/secteur)
    var posRef = null;
    if (S.ui.posGps && isFinite(S.ui.posGps.lat) && S.ui.posGps.lat) {
      posRef = { lat: S.ui.posGps.lat, lon: S.ui.posGps.lon };
    } else if (S.user && S.user.quartier) {
      var rqU = quartiers().filter(function (x) { return x.quartier === S.user.quartier; })[0];
      if (rqU && isFinite(rqU.lat)) posRef = { lat: rqU.lat, lon: rqU.lon };
    }

    tous.forEach(function (e) {
      var coord = (isFinite(e.lat) && isFinite(e.lon) && e.lat) ? { lat: e.lat, lon: e.lon } : null;
      if (!coord && e.quartier) {
        var rq = quartiers().filter(function (x) { return x.quartier === e.quartier; })[0];
        if (rq && isFinite(rq.lat)) coord = { lat: rq.lat, lon: rq.lon };
      }
      e.dist = posRef && coord ? distanceKm(posRef, coord) : 999;
      var memeQuart = S.user && S.user.quartier && e.quartier === S.user.quartier;
      var memeCom = S.user && S.user.commune && e.commune === S.user.commune;
      e.scoreLoc = memeQuart ? 0 : (memeCom ? 1 : 2);
    });

    if (!mots.length) {
      var tri = tous.slice().sort(function (a, b) {
        if (posRef) return (a.dist - b.dist) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr');
        return (a.scoreLoc - b.scoreLoc) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr');
      }).slice(0, 5);
      S.ui.sugLieux[i] = tri;
      if (!tri.length) return '';
      var libTitre = posRef && S.ui.posGps ? '📍 Hôpitaux proches de votre position :' : (S.user && S.user.quartier ? 'Hôpitaux de votre secteur (' + esc(S.user.quartier) + ') :' : 'Hôpitaux fréquents :');
      return '<div class="discret" style="font-size:12px;margin:6px 0 4px;font-weight:700;color:var(--primaire)">' + libTitre + '</div>' +
        '<ul class="sug-liste">' + tri.map(function (e, k) {
          var distTxt = e.dist < 50 ? (e.dist < 1 ? Math.round(e.dist * 1000) + ' m' : km(e.dist)) : '';
          return '<li><button type="button" data-a="ficheChoixLieu" data-i="' + i + '" data-v="' + k + '"><b>' + esc(e.lieu) + '</b><small>' +
            esc([e.quartier, e.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + (distTxt ? ' · ' + distTxt : '') + ' · ' + (e.n ? e.n + ' praticien' + (e.n > 1 ? 's' : '') : 'Hôpital') + '</small></button></li>';
        }).join('') + '</ul>';
    }
    // Dès la 1re lettre tapée : suggestions interactives
    if (!t.length) return '';
    var l = tous.filter(function (e) { return mots.every(function (m) { return e.txt.indexOf(m) >= 0; }); });
    if (l.some(function (e) { return normaliser(e.lieu) === t; })) return '<p class="aide-champ ok-lieu">' + icone('valider') + 'Établissement connu (quartier et GPS repris automatiquement).</p>';
    var rang = function (e) {
      var n = normaliser(e.lieu);
      var r = (mots.every(function (m) { return n.indexOf(m) >= 0; }) ? 0 : 2) + (n.indexOf(mots[0]) === 0 ? 0 : 1);
      return r * 100 + (posRef && e.dist < 100 ? e.dist : e.scoreLoc * 10);
    };
    l.sort(function (a, b) { return rang(a) - rang(b) || (a.dist - b.dist) || (b.n - a.n) || a.lieu.localeCompare(b.lieu, 'fr'); });
    l = l.slice(0, 5); S.ui.sugLieux[i] = l;
    if (!l.length) return '';
    return '<ul class="sug-liste">' + l.map(function (e, k) {
      var distTxt = e.dist < 50 ? (e.dist < 1 ? Math.round(e.dist * 1000) + ' m' : km(e.dist)) : '';
      return '<li><button type="button" data-a="ficheChoixLieu" data-i="' + i + '" data-v="' + k + '"><b>' + esc(e.lieu) + '</b><small>' +
        esc([e.quartier, e.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + (distTxt ? ' · ' + distTxt : '') + ' · ' + (e.n ? e.n + ' praticien' + (e.n > 1 ? 's' : '') : 'Hôpital') + '</small></button></li>';
    }).join('') + '</ul>';
  }
  function lieuVide(estPharma) {
    return { id: '', lieu: '', quartier: '', jours: [0, 1, 2, 3, 4].map(function () { return { matin: true, soir: true }; }),
             horaireMatin: REGLAGES_MOTEUR.horaireMatinDefaut, horaireSoir: REGLAGES_MOTEUR.horaireSoirDefaut, lat: '', lon: '' };
  }
  function brouillonFiche(code) {
    if (!code) {
      var l0 = lieuVide(false);
      if (S.ui.posGps && isFinite(S.ui.posGps.lat)) {
        var rq = Moteur.quartierLePlusProche(S.ui.posGps.lat, S.ui.posGps.lon, quartiers());
        if (rq && rq.quartier) {
          l0.quartier = rq.quartier.quartier;
          l0.commune = rq.quartier.commune;
          l0.lat = S.ui.posGps.lat;
          l0.lon = S.ui.posGps.lon;
          l0.prec = S.ui.posGps.prec;
        }
      }
      return { code: '', type: 'Médecin', nom: '', telephone: '', specialite: '', autreSpec: '', note: 2, conventionne: 'Non', actif: 'Oui', lieux: [l0] };
    }
    var p = (S.data.praticiens || []).filter(function (x) { return x.code === code; })[0] || {};
    var estPh = p.type === 'Pharmacie' || /^PHA-/i.test(code);
    var lieux = (S.data.presences || []).filter(function (x) { return x.code === code; }).map(function (x) {
      var lieuVal = x.lieu || (estPh ? p.nom || '' : '');
      if (!estPh && lieuVal && normaliser(lieuVal) === normaliser(p.nom)) lieuVal = '';
      return { id: x.id, lieu: lieuVal, quartier: x.quartier || p.quartier || '', jours: JOURS_CLES.map(function (j) { return lireDispo(x[j]); }),
               horaireMatin: horaireNormalise(x.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut),
               horaireSoir: horaireNormalise(x.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut),
               lat: x.lat || p.lat || '', lon: x.lon || p.lon || '', commune: x.commune || p.commune || '', zone: x.zone || p.zone || '' };
    });
    if (!lieux.length) {
      var lDef = lieuVide(estPh);
      lDef.lieu = estPh ? (p.nom || '') : '';
      lDef.quartier = p.quartier || '';
      lDef.commune = p.commune || '';
      lDef.lat = p.lat || '';
      lDef.lon = p.lon || '';
      lDef.horaireMatin = horaireNormalise(p.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut);
      lDef.horaireSoir = horaireNormalise(p.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      lieux = [lDef];
    }
    return { code: code, type: estPh ? 'Pharmacie' : 'Médecin', nom: p.nom || '', telephone: String(p.telephone || ''),
             specialite: estPh ? 'Pharmacien' : (p.specialite || ''), autreSpec: '', note: lireNote(p.note), conventionne: estConventionne(p.conventionne) ? 'Oui' : 'Non',
             actif: p.actif === 'Non' ? 'Non' : 'Oui', absentDu: p.absentDu || '', absentAu: p.absentAu || '', lieux: lieux };
  }
  function horaireValide(t) {
    var m = String(t || '').match(/^\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*-\s*(\d{1,2})\s*[:hH]?\s*(\d{2})?\s*$/);
    if (!m) return false;
    var a = +m[1] * 60 + +(m[2] || 0), b = +m[3] * 60 + +(m[4] || 0);
    return +m[1] < 24 && +m[3] < 24 && a < b;
  }
  function synchroniserDefautsFiche(d) {
    if (!d.lieux || !d.lieux.length) d.lieux = [lieuVide(d.type === 'Pharmacie')];
    if (d.type === 'Pharmacie') {
      d.specialite = 'Pharmacien';
      if (String(d.nom || '').trim()) d.lieux[0].lieu = String(d.nom).trim();
      if (!d.lieux[0].jours.some(function (j) { return j.matin || j.soir; })) {
        d.lieux[0].jours = [0, 1, 2, 3, 4].map(function () { return { matin: true, soir: true }; });
      }
    } else {
      if (d.specialite === 'Pharmacien') d.specialite = '';
    }
    // Auto-récupération immédiate du quartier pour tout établissement déjà dans la BDD
    (d.lieux || []).forEach(function (l, idx) {
      if (d.type !== 'Pharmacie' && l && l.lieu && String(l.lieu).trim().length >= 2) {
        if (!l.quartier || /^NL$/i.test(l.quartier) || String(l.quartier).trim() === '') {
          var can = trouverEtablissementBDD(l.lieu, l.quartier, l.commune);
          if (can && can.quartier && !/^NL$/i.test(can.quartier)) {
            l.quartier = can.quartier;
            if (can.commune && !l.commune) l.commune = can.commune;
            if (can.lat && can.lon && !l.lat) { l.lat = can.lat; l.lon = can.lon; }
            if (S.ui && S.ui.feuille && S.ui.feuille.err) {
              delete S.ui.feuille.err['quartier' + idx];
              delete S.ui.feuille.err['lieu' + idx];
            }
          }
        }
      }
    });
  }
  // Erreurs d'une étape : { champ: message }
  function erreursEtape(d, etape) {
    synchroniserDefautsFiche(d);
    var e = {};
    if (etape === 0) {
      if (String(d.nom).trim().length < 2) e.nom = 'Indiquez le nom (2 caractères min.).';
      if (String(d.telephone).trim() && !normaliserNumero(d.telephone)) e.telephone = 'Numéro invalide (ex. 07 07 07 07 07).';
      if (d.type === 'Médecin') {
        if (!d.specialite) e.specialite = 'Choisissez une spécialité.';
        else if (d.specialite === '__autre' && String(d.autreSpec).trim().length < 2) e.autreSpec = 'Précisez la spécialité.';
        if (d.lieux[0] && String(d.lieux[0].lieu).trim().length < 2) e.lieu0 = 'Indiquez l\'établissement ou cabinet.';
      }
      var q0 = d.lieux[0] && d.lieux[0].quartier;
      if (!q0 || /^NL$/i.test(q0) || String(q0).trim() === '') e.quartier0 = 'Choisissez le quartier (ou captez le GPS).';
    }
    if (etape === 1) {
      if (!d.lieux || !d.lieux.length) e.lieux = 'Ajoutez au moins un lieu.';
      if (d.absentAu && !d.absentDu) e.absentDu = 'Indiquez le début de l\'absence.';
      if (d.absentDu && d.absentAu && d.absentAu < d.absentDu) e.absentAu = 'La fin doit suivre le début.';
      (d.lieux || []).forEach(function (l, i) {
        if (d.type === 'Pharmacie' && i === 0) l.lieu = String(d.nom).trim();
        if (String(l.lieu || '').trim().length < 2) e['lieu' + i] = 'Nom de l\'établissement requis.';
        if (!l.quartier || /^NL$/i.test(l.quartier) || String(l.quartier).trim() === '') e['quartier' + i] = 'Choisissez le quartier.';
        var m = l.jours && l.jours.some(function (j) { return j.matin; });
        var so = l.jours && l.jours.some(function (j) { return j.soir; });
        if (!m && !so) e['jours' + i] = 'Cochez au moins une demi-journée.';
        if (m) l.horaireMatin = horaireNormalise(l.horaireMatin, REGLAGES_MOTEUR.horaireMatinDefaut);
        if (so) l.horaireSoir = horaireNormalise(l.horaireSoir, REGLAGES_MOTEUR.horaireSoirDefaut);
      });
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
    var d = f.d, e = Math.min(f.etape || 0, 1); f.etape = e;
    synchroniserDefautsFiche(d);
    var estPh = d.type === 'Pharmacie', l0 = d.lieux[0];
    var h = '<div class="segment" role="group" aria-label="Type" style="margin-bottom:8px">' + ['Médecin', 'Pharmacie'].map(function (t) {
        return '<button type="button" data-a="ficheVal" data-k="type" data-v="' + t + '" aria-pressed="' + (d.type === t) + '">' + t + '</button>';
      }).join('') + '</div>' +
      '<div class="segment" role="group" aria-label="Étapes" style="margin-bottom:10px">' +
        '<button type="button" data-a="ficheAller" data-v="0" aria-pressed="' + (e === 0) + '">' + (estPh ? '1. Pharmacie & Lieu' : '1. Médecin & Hôpital') + '</button>' +
        '<button type="button" data-a="ficheAller" data-v="1" aria-pressed="' + (e === 1) + '">' + (estPh ? '2. Horaires de réception' : '2. Planning hebdomadaire (' + d.lieux.length + ')') + '</button>' +
      '</div>';

    if (e === 0) {
      var q0 = quartiers().filter(function (x) { return x.quartier === l0.quartier; })[0];
      if (estPh) {
        // PHARMACIE : Nom d'abord avec détection anti-doublon en direct, puis localisation fixe
        h += champFiche('nom', 'Nom de la pharmacie *',
          '<input type="text" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '" placeholder="Ex. Pharmacie des Lagunes"' + attrInvalide(f, 'nom') + '>', f, true) +
        '<div id="doublonsFiche">' + rendreDoublonsFiche(d) + '</div>' +
        '<div class="lieu-bloc" style="margin-bottom:10px;padding:10px">' +
          '<div class="lieu-tete" style="margin-bottom:6px"><b>Localisation fixe de l\'officine</b>' +
            (l0.lat && l0.lon ? '<span class="badge-discret ok-gps" style="background:var(--vert-pale,#e6f7ec);color:var(--vert,#1e7e34)">' + icone('cible') + ' GPS</span>' : '') + '</div>' +
          '<div class="gps-ligne" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px">' +
            '<button type="button" class="bouton bouton-plein petit" data-a="ficheGps" data-i="0">' + icone('cible') + (l0.lat && l0.lon ? 'Actualiser GPS ici' : 'Captez ma position GPS') + '</button>' +
            (l0.lat && l0.lon ? '<span class="discret">GPS : <b>' + (+String(l0.lat).replace(',', '.')).toFixed(4) + ', ' + (+String(l0.lon).replace(',', '.')).toFixed(4) + '</b> <button type="button" class="bouton-texte" data-a="ficheGpsEffacer" data-i="0">✕</button></span>' : '<span class="discret">Position fixe de la pharmacie</span>') +
          '</div>' +
          champFiche('quartier0', 'Quartier *', selecteurListe('ficheQuartier0', { titre: 'Quartier', valeur: l0.quartier, vide: 'Choisir un quartier (ou via GPS)…', invalide: !!f.err.quartier0, sections: sectionsQuartiers(),
            appliquer: function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.lieux[0].quartier = v; delete fe.err.quartier0; } } }), f, true, q0 ? 'Commune : ' + esc(q0.commune) : '') +
        '</div>';
      } else {
        // MÉDECIN : Nom et Spécialité, puis Hôpital principal (avec auto-complétion du quartier et GPS)
        h += champFiche('nom', 'Nom du médecin *',
          '<input type="text" data-f="fiche" data-k="nom" autocomplete="off" value="' + esc(d.nom) + '" placeholder="Ex. Dr Kouassi Aya"' + attrInvalide(f, 'nom') + '>', f, true) +
        '<div id="doublonsFiche">' + rendreDoublonsFiche(d) + '</div>';

        var specs = specialitesListe().map(function (x) { return x.nom; }).filter(function (x) { return x !== 'Pharmacien'; });
        SPECIALITES_DEFAUT.forEach(function (x) { if (x !== 'Pharmacien' && specs.indexOf(x) < 0) specs.push(x); });
        specs.sort(function (a, b) { return a.localeCompare(b, 'fr'); });
        if (d.specialite && d.specialite !== '__autre' && d.specialite !== 'Pharmacien' && specs.indexOf(d.specialite) < 0) specs.unshift(d.specialite);
        var coeur = coeurDeCible();
        var specMed = specs.filter(function (s) {
          return coeur.indexOf(s) < 0 && ['Chirurgien', 'Urologue', 'ORL'].indexOf(s) < 0;
        });
        var specChir = specs.filter(function (s) {
          return ['Chirurgien', 'Urologue', 'ORL'].indexOf(s) >= 0;
        });
        var sectionsSpec = [
          { titre: '🎯 Cœur de cible', options: coeur.map(function (s) { return [s, s]; }) },
          { titre: '🩺 Spécialités médicales', options: specMed.map(function (s) { return [s, s]; }) },
          { titre: '🏥 Chirurgie & Autres', options: specChir.map(function (s) { return [s, s]; }).concat([['__autre', 'Autre spécialité…']]) }
        ];

        h += '<div class="puces" style="margin:0 0 6px">' + coeur.map(function (s) {
          return '<button type="button" class="puce petite" data-a="ficheSpecRapide" data-v="' + esc(s) + '" aria-pressed="' + (d.specialite === s) + '">' + esc(s) + '</button>';
        }).join('') + '</div>';
        h += champFiche('specialite', 'Spécialité *', selecteurListe('ficheSpec', { titre: 'Spécialité', valeur: d.specialite, vide: 'Choisir une spécialité…', invalide: !!f.err.specialite,
          sections: sectionsSpec,
          appliquer: function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.specialite = v; delete fe.err.specialite; } } }), f, true);
        if (d.specialite === '__autre') h += champFiche('autreSpec', 'Autre spécialité *', '<input type="text" data-f="fiche" data-k="autreSpec" value="' + esc(d.autreSpec) + '"' + attrInvalide(f, 'autreSpec') + '>', f, true);

        h += '<div class="lieu-bloc" style="margin-bottom:10px;padding:10px">' +
          '<div class="lieu-tete" style="margin-bottom:4px"><b>Hôpital / Établissement principal</b>' +
            (l0.quartier && l0.lat ? '<span class="badge-discret ok-gps" style="background:var(--vert-pale,#e6f7ec);color:var(--vert,#1e7e34);margin-left:6px">✓ Quartier & GPS auto-remplis</span>' : '') +
            (d.lieux.length > 1 ? '<span class="badge-discret">+' + (d.lieux.length - 1) + ' autre(s)</span>' : '') + '</div>' +
          champFiche('lieu0', 'Nom de l\'hôpital ou clinique *', '<input type="text" data-f="fiche" data-k="lieu" data-i="0" value="' + esc((!d.type || d.type === 'Médecin') && normaliser(l0.lieu) === normaliser(d.nom) ? '' : (l0.lieu || '')) + '" placeholder="Tapez les premières lettres de l\'hôpital souhaité…"' + attrInvalide(f, 'lieu0') + ' autocomplete="off">', f, true) +
          '<div class="sug-lieux" id="sugLieu0">' + suggestionsLieu(l0.lieu, 0) + '</div>' +
          champFiche('quartier0', 'Quartier de l\'établissement *', selecteurListe('ficheQuartier0', { titre: 'Quartier', valeur: l0.quartier, vide: 'Choisir le quartier de l\'établissement…', invalide: !!f.err.quartier0, sections: sectionsQuartiers(),
            appliquer: function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.lieux[0].quartier = v; delete fe.err.quartier0; } } }), f, true, q0 ? 'Commune : ' + esc(q0.commune) : '') +
          '<div class="gps-ligne" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px">' +
            '<button type="button" class="bouton petit" data-a="ficheGps" data-i="0">' + icone('cible') + (l0.lat && l0.lon ? 'Actualiser GPS du lieu' : 'GPS de l\'établissement') + '</button>' +
            '<button type="button" class="bouton petit" data-a="ficheEtape" data-v="1">' + icone('plus') + 'Jours / Autre hôpital →</button>' +
          '</div>' +
        '</div>';
      }

      // Téléphone, Potentiel & Engagé
      h += champFiche('telephone', 'Téléphone', '<input type="tel" inputmode="tel" data-f="fiche" data-k="telephone" value="' + esc(d.telephone) + '" placeholder="07 07 07 07 07"' + attrInvalide(f, 'telephone') + '>', f, false) +
        '<div class="champ"><span class="requis">Potentiel</span><div class="segment" role="group" aria-label="Potentiel" style="margin:0">' +
        [3, 2, 1].map(function (n) {
          var l = lettrePotentiel(n);
          return '<button type="button" data-a="ficheVal" data-k="note" data-v="' + n + '" aria-pressed="' + (+d.note === n) + '">' + ETOILES[l] + ' ' + LIB_POTENTIEL[l] + '</button>';
        }).join('') + '</div></div>' +
        '<label class="interrupteur"><span>' + (estPh ? 'Partenariat / commande engagée' : 'Prescription engagée') + '</span><input type="checkbox" data-f="fiche" data-k="conventionne"' + (d.conventionne === 'Oui' ? ' checked' : '') + '></label>';
      if (d.code) h += '<label class="interrupteur"><span>Actif dans le répertoire</span><input type="checkbox" data-f="fiche" data-k="actif"' + (d.actif !== 'Non' ? ' checked' : '') + '></label>';
    }

    if (e === 1) {
      if (f.err.lieux) h += '<p class="erreur-texte">' + esc(f.err.lieux) + '</p>';
      if (typeof f.lieuOuvert !== 'number' || f.lieuOuvert < 0 || f.lieuOuvert >= d.lieux.length) {
        f.lieuOuvert = 0;
      }
      d.lieux.forEach(function (l, i) {
        if (estPh && i > 0) return;
        var q = quartiers().filter(function (x) { return x.quartier === l.quartier; })[0];
        var estOuvert = (i === f.lieuOuvert);

        if (!estPh && !estOuvert) {
          // Lieu replié en accordéon (un seul ouvert à la fois)
          var nbJ = l.jours ? l.jours.filter(function (j) { return j.matin || j.soir; }).length : 0;
          var resumeJ = nbJ === 5 ? 'Toute la semaine' : (nbJ > 0 ? nbJ + ' j/semaine' : 'Aucun jour');
          h += '<div class="lieu-bloc-plie" data-a="ficheOuvrirLieu" data-i="' + i + '">' +
            '<div class="lieu-plie-info">' +
              '<span class="badge-discret">Lieu ' + (i + 1) + '</span>' +
              '<div class="lieu-plie-textes">' +
                '<b class="lieu-plie-nom">' + esc(l.lieu || 'Établissement à renseigner') + '</b>' +
                '<small class="discret">' + esc([l.quartier, l.commune].filter(Boolean).join(', ') || 'Quartier non renseigné') + ' · ' + resumeJ + (l.lat && l.lon ? ' · ✓ GPS' : '') + '</small>' +
              '</div>' +
            '</div>' +
            '<div class="lieu-plie-actions">' +
              '<button type="button" class="bouton petit" data-a="ficheOuvrirLieu" data-i="' + i + '">Déplier ▼</button>' +
              (d.lieux.length > 1 ? '<button type="button" class="bouton-texte sortir-question" data-a="ficheRetirerLieu" data-i="' + i + '" title="Supprimer ce lieu">✕</button>' : '') +
            '</div>' +
          '</div>';
          return;
        }

        // Lieu ouvert
        var m = l.jours.some(function (j) { return j.matin; }), so = l.jours.some(function (j) { return j.soir; });
        h += '<div class="lieu-bloc"><div class="lieu-tete"><b>' + (estPh ? esc(d.nom || 'Horaires de réception de la pharmacie') : (d.lieux.length > 1 ? '▼ ' : '') + 'Hôpital / Lieu ' + (i + 1) + (l.lieu ? ' · ' + esc(l.lieu) : '')) + '</b>' +
          '<div>' +
            (!estPh && d.lieux.length > 1 ? '<button type="button" class="bouton-texte" data-a="ficheReplierLieu" data-i="' + i + '" style="margin-right:6px">Replier ▲</button>' : '') +
            (!estPh && d.lieux.length > 1 ? '<button type="button" class="bouton-texte sortir-question" data-a="ficheRetirerLieu" data-i="' + i + '">Supprimer</button>' : '') +
          '</div></div>';
        if (estPh) {
          h += '<p class="sous-titre" style="margin:0 0 8px">Jours et plages où l\'officine reçoit les délégués médicaux (tous cochés par défaut).</p>';
        } else if (i === 0 && (l.lieu || l.quartier) && !f.editerLieu0 && !f.err.lieu0 && !f.err.quartier0) {
          // 3.25.44 : Lieu 1 déjà renseigné à l'étape 1 — résumé compact sans doublon pour afficher directement la grille des jours
          h += '<div class="lieu-resume-simple" style="display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--fond-carte,#f8f9fa);border:none;box-shadow:none;border-radius:8px;padding:8px 12px;margin:0 0 10px">' +
            '<div><b style="font-size:0.95rem">' + esc(l.lieu || 'Établissement principal') + '</b>' +
            '<div class="discret" style="font-size:0.8rem">' + esc([l.quartier, l.commune || (q ? q.commune : '')].filter(Boolean).join(', ')) + (l.lat && l.lon ? ' · ' + icone('cible') + ' GPS' : '') + '</div></div>' +
            '<button type="button" class="bouton-texte" data-a="ficheEditerLieu0" style="font-size:0.8rem">Modifier l\'adresse</button>' +
            '</div>';
        } else {
          h += champFiche('lieu' + i, (i === 0 ? 'Nom de l\'hôpital ou clinique *' : 'Établissement ou cabinet *'), '<input type="text" data-f="fiche" data-k="lieu" data-i="' + i + '" value="' + esc(!estPh && normaliser(l.lieu) === normaliser(d.nom) ? '' : (l.lieu || '')) + '" placeholder="Tapez les premières lettres de l\'hôpital souhaité…"' + attrInvalide(f, 'lieu' + i) + ' autocomplete="off">', f, true) +
            '<div class="sug-lieux" id="sugLieu' + i + '">' + suggestionsLieu(l.lieu, i) + '</div>' +
            champFiche('quartier' + i, 'Quartier *', selecteurListe('ficheQuartier' + i, { titre: 'Quartier', valeur: l.quartier, vide: 'Choisir un quartier…', invalide: !!f.err['quartier' + i], sections: sectionsQuartiers(),
              appliquer: (function (k) { return function (v) { var fe = S.ui.feuille; if (fe && fe.type === 'fiche') { fe.d.lieux[k].quartier = v; delete fe.err['quartier' + k]; } }; })(i) }), f, true, q ? 'Commune : ' + esc(q.commune) : '') +
            '<div class="gps-ligne gps-centre" style="margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
              '<div style="display:flex;align-items:center;gap:6px">' +
                '<button type="button" class="bouton petit" data-a="ficheGps" data-i="' + i + '">' + icone('cible') + 'GPS de ce lieu</button>' +
                (l.lat && l.lon ? '<button type="button" class="bouton-texte" data-a="ficheGpsEffacer" data-i="' + i + '" title="Effacer GPS">✕</button>' : '') +
              '</div>' +
              (l.lat && l.lon ? '<span>GPS : <b>' + (+String(l.lat).replace(',', '.')).toFixed(4) + ', ' + (+String(l.lon).replace(',', '.')).toFixed(4) + '</b></span>' : '<span class="discret">Pas de GPS</span>') +
            '</div>';
        }
        var tousM = l.jours.every(function (j) { return j.matin; }), tousS = l.jours.every(function (j) { return j.soir; });
        h += '<div class="dispo-raccourcis" style="display:flex;flex-direction:column;align-items:center;gap:6px;margin:0 0 10px">' +
          '<button type="button" class="puce petite puce-tous" style="width:100%;max-width:240px;justify-content:center" data-a="ficheJoursTous" data-i="' + i + '" data-c="tout" aria-pressed="' + (tousM && tousS) + '">Toute la semaine</button>' +
          '<div style="display:flex;justify-content:center;gap:8px;width:100%">' +
            '<button type="button" class="puce petite" style="flex:1;max-width:140px;justify-content:center" data-a="ficheJoursTous" data-i="' + i + '" data-c="matin" aria-pressed="' + tousM + '">Tous les matins</button>' +
            '<button type="button" class="puce petite" style="flex:1;max-width:140px;justify-content:center" data-a="ficheJoursTous" data-i="' + i + '" data-c="soir" aria-pressed="' + tousS + '">Tous les soirs</button>' +
          '</div></div>' +
          '<div class="grille-dispo" role="group" aria-label="Présences du lieu ' + (i + 1) + '"><span></span><span class="entete-col">Matin</span><span class="entete-col">Soir</span>' +
          JOURS.map(function (j, k) {
            return '<span class="jour-nom">' + j + '</span>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="matin" aria-pressed="' + l.jours[k].matin + '" aria-label="' + j + ' matin">' + (l.jours[k].matin ? 'Oui' : '–') + '</button>' +
              '<button type="button" data-a="ficheJour" data-i="' + i + '" data-j="' + k + '" data-c="soir" aria-pressed="' + l.jours[k].soir + '" aria-label="' + j + ' soir">' + (l.jours[k].soir ? 'Oui' : '–') + '</button>';
          }).join('') + '</div>' +
          '<span class="erreur" data-err="jours' + i + '">' + esc(f.err['jours' + i] || '') + '</span>' +
          '<div class="grille-2">' +
          champFiche('hm' + i, 'Matin', '<input type="text" data-f="fiche" data-k="horaireMatin" data-i="' + i + '" value="' + esc(l.horaireMatin) + '"' + (m ? '' : ' disabled') + attrInvalide(f, 'hm' + i) + '>', f, m) +
          champFiche('hs' + i, 'Soir', '<input type="text" data-f="fiche" data-k="horaireSoir" data-i="' + i + '" value="' + esc(l.horaireSoir) + '"' + (so ? '' : ' disabled') + attrInvalide(f, 'hs' + i) + '>', f, so) +
          '</div></div>';
      });
      if (!estPh) {
        h += '<button class="bouton bouton-large" type="button" data-a="ficheAjouterLieu">' + icone('plus') + 'Ajouter un autre hôpital / clinique</button>';
        h += '<div class="lieu-bloc" style="margin-top:10px"><div class="lieu-tete"><b>Absence (congés, formation…)</b></div>' +
          '<div class="grille-2">' +
          champFiche('absentDu', 'Du', '<input type="date" data-f="fiche" data-k="absentDu" value="' + esc(d.absentDu || '') + '"' + attrInvalide(f, 'absentDu') + '>', f, false) +
          champFiche('absentAu', 'Au', '<input type="date" data-f="fiche" data-k="absentAu" value="' + esc(d.absentAu || '') + '"' + attrInvalide(f, 'absentAu') + '>', f, false) +
          '</div></div>';
      }
    }

    var pied = (e === 0
      ? '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">Annuler</button>' +
        '<button class="bouton" type="button" data-a="ficheEtape" data-v="1">' + (estPh ? 'Jours de réception →' : 'Jours & Horaires →') + '</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>'
      : '<button class="bouton-texte sortir-question" type="button" data-a="fermerFeuille">Annuler</button>' +
        '<button class="bouton" type="button" data-a="ficheEtape" data-v="-1">← 1. Identité & Lieu</button>' +
        '<button class="bouton bouton-plein" type="button" data-a="ficheEnregistrer">' + icone('valider') + 'Enregistrer</button>');
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
    synchroniserDefautsFiche(d);
    // 3.25.34 : Vérification et normalisation officielle des hôpitaux pour éviter fautes et doublons en BDD
    if (d.type !== 'Pharmacie' && Array.isArray(d.lieux)) {
      d.lieux.forEach(function (l) {
        var can = canonicaliserEtablissement(l.lieu, l.quartier, l.commune);
        if (can) {
          l.lieu = can.lieu;
          if (!l.quartier || /^NL$/i.test(l.quartier)) l.quartier = can.quartier;
          if (!l.commune || /^NL$/i.test(l.commune)) l.commune = can.commune;
          if ((!l.lat || /^NL$/i.test(l.lat)) && can.lat) { l.lat = can.lat; l.lon = can.lon; }
        }
      });
    }
    // 3.25.23 : évite de recréer un 2e code TMP si la même fiche locale est déjà en file d'attente
    var code = d.code;
    if (!code && S.data && S.data.praticiens) {
      var existTmp = S.data.praticiens.filter(function (x) { return /^TMP-/.test(x.code) && x.type === d.type && nomCleDoublon(x.nom) === nomCleDoublon(d.nom); })[0];
      if (existTmp) code = existTmp.code;
    }
    if (!code) code = 'TMP-' + Date.now().toString(36).toUpperCase();
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
  // carte ouverte : centrée dans l'espace visible (entre l'en-tête et la barre du bas) ; si elle est plus haute, son haut est aligné
  function centrerCarte(uid) { centrerQuestion(uid); }
  function centrerElement(c, forceQuestion) {
    if (!c) return;
    var cibleEl = (forceQuestion !== false && c.querySelector) ? (c.querySelector('.cr-question') || c.querySelector('.actions-cr') || c.querySelector('.rangee-actions-cr-valide') || c) : c;
    if (!cibleEl) cibleEl = c;
    requestAnimationFrame(function () {
      setTimeout(function () {
        var r = cibleEl.getBoundingClientRect(), ent = (document.querySelector('.entete') || { offsetHeight: 0 }).offsetHeight,
            nav = (document.querySelector('.navigation') || { offsetHeight: 0 }).offsetHeight, dispo = window.innerHeight - ent - nav;
        var idealY;
        if (r.height <= dispo - 20) {
          idealY = ent + Math.max(16, (dispo - r.height) * 0.45);
        } else {
          idealY = window.innerHeight - nav - r.height - 16;
        }
        window.scrollTo({ top: Math.max(0, window.scrollY + r.top - idealY), behavior: 'smooth' });
      }, 30);
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
      if (!p.prochaine || p.prochaine < debut || p.prochaine > fin || dejaImposes[p.code]) return false;
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
      S.ui.posGps = { lat: p.lat, lon: p.lon, t: Date.now(), prec: p.prec }; LS.set('derniereGps', S.ui.posGps);
      var A = S.ui.autour, r = Moteur.quartierLePlusProche(p.lat, p.lon, quartiers());
      if (!discret || forcerGps || positionGps()) {
        A.lat = p.lat; A.lon = p.lon; A.src = 'gps'; A.prec = p.prec; A.t = Date.now();
        A.label = r ? 'ma position (près ' + (/^[aeiouyéèàâîôûAEIOUYÉÈÀÂÎÔÛ]/.test(r.quartier.quartier) ? 'd\'' : 'de ') + r.quartier.quartier + ')' : 'ma position';
        LS.set('autour', A);
      }
      rendreSiPossible();
      alerteProximite(declencheur === 'ouverture' || !discret);
      if (!discret && p.prec > 150) toast('Position imprécise (± ' + p.prec + ' m). Activez la « localisation précise » du téléphone, ou sortez à découvert.');
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
    A.label = r ? 'ma position (près ' + (/^[aeiouyéèàâîôûAEIOUYÉÈÀÂÎÔÛ]/.test(r.quartier.quartier) ? 'd\'' : 'de ') + r.quartier.quartier + ')' : 'ma position';
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
  function mesurePrecise(ok, ko) {
    if (!navigator.geolocation) { if (ko) ko(); return; }
    var best = null, fini = false, id = null, t = null;
    function terminer() {
      if (fini) return; fini = true;
      if (id !== null) navigator.geolocation.clearWatch(id); clearTimeout(t);
      if (best) ok({ lat: best.coords.latitude, lon: best.coords.longitude, prec: Math.round(best.coords.accuracy || 0) });
      else if (ko) ko();
    }
    try {
      navigator.geolocation.getCurrentPosition(function (p) {
        if (fini) return;
        var prec = precisionDe(p);
        if (prec <= 500 && (!best || prec < precisionDe(best))) best = p;
        if (precisionDe(best) <= 35) terminer();
      }, function () {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    } catch (e) {}
    id = navigator.geolocation.watchPosition(function (p) {
      if (fini) return;
      var prec = precisionDe(p);
      if (!best || prec < precisionDe(best)) {
        if (prec <= 800 || !best) best = p;
      }
      if (precisionDe(best) <= 35) terminer();
    }, function (e) { if (e && e.code === 1) terminer(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
    t = setTimeout(terminer, 12000);
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
  function gpsPrecis() { var g = S.ui.posGps; return !!(g && Date.now() - g.t < 5 * 60000 && g.prec && g.prec <= 60); }
  // 3.25.8 : position actuelle connue : GPS de moins de 15 min, sinon le point choisi dans « Autour de moi »
  function positionActuelle() {
    var g = S.ui.posGps; if (g && Date.now() - g.t < 15 * 60000) return { lat: g.lat, lon: g.lon };
    var A = S.ui.autour; return A && A.lat !== null && A.lat !== undefined ? { lat: A.lat, lon: A.lon } : null;
  }
  // position issue du GPS (et non d'un quartier choisi) : à recalculer à chaque ouverture
  // 3.25.9 : rayons proposés autour de moi
  var RAYONS = [0.5, 2, 5, 10];
  // 3.25.14 : 0,5 km par défaut (une fois pour tous)
  if (!LS.get('rayon05', false) || RAYONS.indexOf(+S.ui.autour.rayon) < 0) { S.ui.autour.rayon = 0.5; LS.set('autour', S.ui.autour); LS.set('rayon05', true); }
  // dernière position connue du téléphone (mémoire), utilisée tout de suite au démarrage
  if (!S.ui.posGps) { var dg = LS.get('derniereGps', null); if (dg && isFinite(dg.lat)) S.ui.posGps = dg; }
  function positionGps() { var A = S.ui.autour; return A.src === 'gps' || (!A.src && /^ma position/.test(A.label || '')) || A.lat === null; }
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
      var refGeo = qDecl && isFinite(qDecl.lat) ? { lat: qDecl.lat, lon: qDecl.lon } : (l.lat && l.lon ? { lat: parseFloat(String(l.lat).replace(',', '.')), lon: parseFloat(String(l.lon).replace(',', '.')) } : null);
      var distKm = refGeo && isFinite(refGeo.lat) ? distanceVol(pCapt, refGeo) : 0;
      var nomLieu = l.lieu ? (l.lieu + (l.quartier ? ' (' + l.quartier + ')' : '')) : (l.quartier || l.commune || d.nom);

      function sauverDirect() {
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
        confirmerPuis('🛑 Écart de position important',
          '<div style="color:var(--rouge,#c0392b);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieu) + ' !</div>' +
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

  var ACTIONS = {
    nav: function (el) {
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
    crStatutExpress: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.statut = el.dataset.v;
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
      centrerQuestion(a.uid);
    },
    crEtapeRapide: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      c.prochaine = el.dataset.v || '';
      syncCr(a);
      LS.set('plan', S.plan);
      rendre();
    },
    basculerModeComplet: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = true;
      rendre();
    },
    basculerModeExpress: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      a.modeComplet = false;
      rendre();
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
    ouvrirAutour: function () { S.ui.pharmaciesProches = false; S.ui.rechAutourLibre = ''; S.ui.tab = 'autour'; rendre(); window.scrollTo(0, 0); relocaliserSiBesoin(); },
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
    calOuvrir: function () {
      var d = jourAffiche();
      S.ui.feuille = { type: 'calendrierJour', titre: 'Choisir une date', date: d, mois: d.slice(0, 7) };
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
      var d = el.dataset.v;
      S.ui.feuille = null;
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

    corriger: function (el) {
      var a = arret(el.dataset.uid); if (!a) return; a.etat = 'correction'; a.corrige = true; a.empreinte = empreinteCr(a);
      var c = crDe(a); c.ok = c.ok || {}; etapesCr(a).forEach(function (x) { if (x.id && x.id.indexOf('__') !== 0) c.ok[x.id] = true; }); S.ui.ouvert = a.uid; LS.set('plan', S.plan); rendre(); },
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
      S.ui.feuille = { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(j), pleine: true }; rendre();
    },
    ajouterCandidat: function (el) {
      var c = Moteur.creneauParCle(ctx(), el.dataset.v), d = S.ui.dateAjout || S.ui.jour; if (!c) return;
      var fAvant = S.ui.feuille && JSON.parse(JSON.stringify(S.ui.feuille));
      var retourAjout = function () { S.ui.feuille = el.dataset.r === 'recherche' && fAvant ? fAvant : { type: 'ajouterCommunes', titre: (S.ui.typeAjout ? 'Selon mes filtres, ' : 'Communes du ') + dateCourte(d), pleine: true }; rendre(); };
      confirmerPuis('Ajouter à la tournée', 'Ajouter <b>' + esc(c.prat.nom) + '</b> (' + esc(c.lieu) + ', ' + c.creneau.toLowerCase() + ') au ' + dateFr(d) + ' ?', 'Ajouter',
        function () { ajouterArret(c, d); rendre(); }, retourAjout);
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
    imposerDirect: function (el) { S.ui.feuille = { type: 'recherche', titre: 'Ajouter à ma tournée', code: el.dataset.v, cle: '' }; rendre(); },
    visiteInopineeDirect: function (el) {
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
    crChoix: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      majCr(a, el.dataset.k, el.dataset.v); validerEtape(a, el.dataset.k); rendre(); centrerQuestion(a.uid);
    },
    crOk: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      if (el.dataset.v === 'types') {
        memoriserDerniersTypesCr(estPharmacie(a), c.types);
      }
      if (el.dataset.v === 'produits') {
        c.reactions = c.reactions || {};
        if (!estPharmacie(a)) memoriserDerniersProduitsCr(c.produits);
        produitsPresentes(c).forEach(function (p) {
          if (!Object.prototype.hasOwnProperty.call(c.reactions, p)) c.reactions[p] = 'Intéressé';
        });
      }
      if (el.dataset.v === 'produitsStock') {
        c.stocks = c.stocks || {};
        (c.produitsStock || []).forEach(function (p) {
          if (!c.stocks[p] || !c.stocks[p].etat) c.stocks[p] = Object.assign(c.stocks[p] || {}, { etat: 'Disponible' });
        });
        memoriserDerniersProduitsStockCr(c.produitsStock || []);
      }
      validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid);
    },
    crPasser: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var champs = { precision: ['precision'], bilan: ['bilan'], commentaire: ['commentaire'], besoin: ['besoinTexte'] }[el.dataset.v] || [];
      champs.forEach(function (k) { majCr(a, k, ''); });
      if (el.dataset.v === 'besoin') crDe(a).besoin = [];
      syncCr(a); validerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid);
    },
    crEditer: function (el) { var a = arret(el.dataset.uid); if (!a) return; editerEtape(a, el.dataset.v); rendre(); centrerQuestion(a.uid); },
    crDate: function (el) {
      var a = arret(el.dataset.uid); if (!a) return;
      var c = crDe(a);
      majCr(a, 'date', el.dataset.v); validerEtape(a, 'date'); rendre(); centrerQuestion(a.uid);
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
        if (a) centrerQuestion(a.uid);
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
    nouvelleFiche: function () { S.ui.feuille = { type: 'fiche', titre: 'Nouveau praticien', pleine: true, etape: 0, d: brouillonFiche(''), err: {} }; rendre(); },
    modifierFiche: function (el) {
      var code = el.dataset.v || S.ui.contactOuvert;
      if (!code) return;
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: 'Modifier la fiche', pleine: true, etape: 0, d: d, err: {}, initial: JSON.stringify(d) };
      rendre();
    },
    modifierActif: function () {
      var code = S.ui.contactOuvert;
      if (!code) {
        toast('Touchez d\'abord un médecin ou une pharmacie dans la liste.');
        return;
      }
      var d = brouillonFiche(code);
      S.ui.feuille = { type: 'fiche', titre: 'Modifier ' + (d.nom || 'la fiche'), pleine: true, etape: 0, d: d, err: {}, initial: JSON.stringify(d) };
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
        etape: 1,
        d: d,
        err: {},
        initial: JSON.stringify(d)
      };
      rendre();
    },
    ouvrirDoublon: function (el) {
      var d = brouillonFiche(el.dataset.v);
      S.ui.feuille = { type: 'fiche', titre: 'Modifier la fiche existante', pleine: true, etape: 0, d: d, err: {}, initial: JSON.stringify(d) };
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
    ficheAjouterLieu: function () {
      var f = S.ui.feuille;
      if (f && f.d && f.d.lieux) {
        f.d.lieux.push(lieuVide(false));
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
        var avant = l.lat && l.lon ? { lat: parseFloat(String(l.lat).replace(',', '.')), lon: parseFloat(String(l.lon).replace(',', '.')) } : null;
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
          confirmerPuis('🛑 Écart de position important',
            '<div style="color:var(--rouge,#c0392b);font-weight:700;margin-bottom:8px">Attention : vous êtes à ' + distArr + ' km de ' + esc(nomLieuRef) + ' !</div>' +
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
      synchroniserDefautsFiche(f.d);
      for (var i = 0; i < 2; i++) {
        var e = erreursEtape(f.d, i);
        if (Object.keys(e).length) { f.etape = i; f.err = e; rendre(); focusErreur(); toast('Complétez les champs signalés.'); return; }
      }
      if (!f.d.code && !f.doublonConfirme) {
        var doublons = chercherDoublonsFiche(f.d).filter(function (x) { return x.exact; });
        if (doublons.length) {
          var ex = doublons[0].p, fSauve = JSON.parse(JSON.stringify(f));
          confirmerPuis('Doublon potentiel',
            '<b>' + esc(ex.nom) + '</b> (' + esc(doublons[0].lieu || ex.specialite) + ') existe déjà dans la base.<br>Voulez-vous ouvrir sa fiche existante au lieu de créer un doublon ?',
            'Ouvrir la fiche existante',
            function () {
              var dEx = brouillonFiche(ex.code);
              S.ui.feuille = { type: 'fiche', titre: 'Modifier la fiche existante', pleine: true, etape: 0, d: dEx, err: {}, initial: JSON.stringify(dEx) };
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

  document.addEventListener('click', function (e) {
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
  document.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset && el.dataset.f, pos;
    if (f === 'commentaire') { var a = arret(el.dataset.uid); if (a) { a.commentaire = el.value; LS.set('plan', S.plan); } }
    if (f === 'cr') { var ac = arret(el.dataset.uid); if (ac) majCr(ac, el.dataset.k, el.value); }
    if (f === 'fiche') {
      majChampFiche(el, false);
      if (el.dataset.k === 'lieu') {
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
      }
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
    if (f === 'rechRemplacer' && S.ui.feuille) {
      S.ui.feuille.q = el.value;
      var aR = arret(S.ui.feuille.uid);
      var cands = aR ? candidatsRemplacement(aR) : [];
      var zrR = document.getElementById('resRemplacer');
      if (zrR) zrR.innerHTML = listeCandidatsRemplacementHtml(S.ui.feuille, cands, el.value);
    }
    if (f === 'chercheOption') {
      var fe = S.ui.feuille; fe.q = fe.q || {}; fe.q[el.dataset.g] = el.value;
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
        delete f.err['lieu' + i];
        rendre();
        return;
      }
    }
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
      crayon: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
      poubelle: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
      eclair: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
    }[n] || '';
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  }

  // ------------------------------------------------------------------ Démarrage
  window.addEventListener('online', function () { synchroniser(true); });
  window.addEventListener('offline', function () { S.ui.sync = 'horsligne'; afficherEntete(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
      if (e.data && e.data.type === 'BACKGROUND_SYNC') {
        if (connecte() && navigator.onLine) synchroniser(true);
      }
    });
  }
  // Chargement asynchrone des données flash IndexedDB
  IDB.init().then(function () {
    return Promise.all(['data', 'plan', 'archives', 'queue', 'fiches'].map(function (k) {
      return IDB.get(k).then(function (val) {
        if (val !== null && val !== undefined) {
          LS._mem[k] = val;
          if (k === 'data' && (!S.data || !S.data.praticiens)) S.data = val;
          if (k === 'plan' && (!S.plan || !S.plan.length)) S.plan = val;
        }
      });
    }));
  }).then(function () {
    rendreSiPossible();
  });
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.ui.installEvt = e; if (S.ui.tab === 'reglages') rendre(); });
  // 3.25.28 : recalcul de la position et des distances à l'ouverture, réouverture, focus et réveil
  setTimeout(function () { relocaliserSiBesoin('ouverture'); }, 0);
  window.addEventListener('pageshow', function () { relocaliserSiBesoin('ouverture'); });
  window.addEventListener('focus', function () { relocaliserSiBesoin('ouverture'); });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    relocaliserSiBesoin('ouverture');
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
    h += '<p class="lancement-astuce" id="lancementAstuce">' + (S.ui.lancementAuto ? 'Touchez l\'écran pour suspendre le décompte et lire tranquillement' : 'Prenez le temps de lire puis lancez votre journée ci-dessous') + '</p>';
    h += pret() ? '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>' +
        '<button class="bouton" type="button" data-a="fermerLancement" data-tab="bilan" style="margin-top:10px">Voir mon bilan</button>'
      : '<button class="bouton bouton-plein" type="button" data-a="fermerLancement" data-tab="jour">Lancer l\'application</button>';
    el.innerHTML = h + '</div></div>';
    el.hidden = false;
    if (pret() && S.ui.lancementAuto) demarrerDecompte();
  }
  // Lancement automatique : l'écran d'accueil se ferme seul et ouvre la tournée.
  // Un toucher sur l'écran d'accueil arrête le décompte et laisse tout le temps de lire.
  var minuteurLancement = null;
  function demarrerDecompte() {
    if (minuteurLancement) return;
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
    if (minuteurLancement) { clearInterval(minuteurLancement); minuteurLancement = null; }
    var a = document.getElementById('lancementAstuce');
    if (a) a.textContent = 'Décompte suspendu — prenez le temps de lire puis lancez l\'application ci-dessous.';
    var d = document.querySelector('#lancement .decompte'); if (d) d.remove();
  }
  // Un toucher sur l'accueil suspend le décompte pour laisser lire (au lieu de fermer instantanément)
  function suspendreLancementSurToucher(e) {
    if (!S.ui.lancement || !e.target.closest || !e.target.closest('#lancement')) return;
    if (e.target.closest('[data-a]')) return; // les boutons exécutent leur action
    arreterDecompte();
  }
  document.addEventListener('pointerdown', suspendreLancementSurToucher, { passive: true });
  document.addEventListener('touchstart', suspendreLancementSurToucher, { passive: true });
  document.addEventListener('click', suspendreLancementSurToucher);

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
  if (S.ui.lancement) {
    S.ui.lancementAuto = true;
    S.ui.lancementFin = Date.now() + 1000 * (S.ui.nouveautes && S.ui.nouveautes.length ? DELAI_LANCEMENT_NOUVEAUTES : DELAI_LANCEMENT);
  }
  // 3.24.5 : « Pharmacie » abrégé en « Phcie » à l'écran seulement (cartes, listes, feuilles, messages).
  // On ne touche qu'aux textes affichés : ni les valeurs des champs, ni les attributs, ni les données,
  // ni les textes partagés (WhatsApp, exports) ; les lecteurs d'écran gardent le mot entier (aria-label).
  (function () {
    var RE = /\bPharmacie\b|\bPHARMACIE\b/g, EXCLUS = { TEXTAREA: 1, SCRIPT: 1, STYLE: 1, OPTION: 1, INPUT: 1, SELECT: 1 };
    var RE_BLVD = /\bBoulevard\b/gi;
    var RE_CSU = /\bCSU\s+Communautaire\b/gi;
    function abreger(n) {
      if (n.nodeType === 3) {
        var p = n.parentNode; if (!p || EXCLUS[p.nodeName] || (p.closest && p.closest('[contenteditable],textarea,select,.texte-entier'))) return;
        var txt = n.nodeValue;
        if (RE.test(txt)) { RE.lastIndex = 0; txt = txt.replace(RE, function (m) { return m === 'PHARMACIE' ? 'PHCIE' : 'Phcie'; }); }
        if (RE_BLVD.test(txt)) { RE_BLVD.lastIndex = 0; txt = txt.replace(RE_BLVD, 'Blvd.'); }
        if (RE_CSU.test(txt)) { RE_CSU.lastIndex = 0; txt = txt.replace(RE_CSU, 'CSU COM'); }
        if (txt !== n.nodeValue) n.nodeValue = txt;
        return;
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

  // 3.25.42 : Intégration du bouton retour physique / geste Android pour refermer les modales sans quitter la PWA
  function gererHistoriqueModal(ouvert) {
    try {
      if (ouvert) {
        if (!history.state || !history.state.mediplannerModal) {
          history.pushState({ mediplannerModal: true }, '');
        }
      }
    } catch (e) {}
  }
  window.addEventListener('popstate', function () {
    if (S.ui.feuille) {
      ACTIONS.fermerFeuille();
      return;
    }
    if (S.ui.ouvert) {
      S.ui.ouvert = null;
      rendre();
      return;
    }
    if (S.ui.contactOuvert) {
      S.ui.contactOuvert = null;
      rendre();
      return;
    }
  });

  // Accès pour les tests automatisés
  window.__tournees = { S: S, ctx: ctx, actualiserLieux: actualiserLieux, texteProgramme: texteProgramme, texteRapport: texteRapport, urlWhatsapp: urlWhatsapp, normaliserNumero: normaliserNumero,
                        supprimerJourPlanifie: supprimerJourPlanifie, demanderSuppressionJour: demanderSuppressionJour,
                        version: APP_VERSION, calculerStats: calculerStats, filtrerPraticiens: filtrerPraticiens, erreursEtape: erreursEtape, rendre: rendre };
})();
