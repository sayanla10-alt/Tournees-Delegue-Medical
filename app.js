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




  var APP_VERSION = '3.25.21';
  // Nouveautés par version : l'écran d'accueil affiche, une seule fois, celles des versions
  // publiées depuis la dernière ouverture du téléphone
  var JOURNAL = [
    ['3.25.21', ['Planifier : bouton « Accepter » sous Ajouter et Recalculer', 'Répertoire : nouvelle phrase d\'introduction']],
    ['3.25.20', ['Journée, Autour de moi : critères et filtres uniformisés avec l\'onglet Répertoire']],
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
