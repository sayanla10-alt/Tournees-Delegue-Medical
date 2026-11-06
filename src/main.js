/* =============================================================================
   src/main.js : Point d'entrée de l'architecture modulaire de MediPlanner
   
   Architecture découplée en domaines métier indépendants :
   - src/core/    : Constantes, version, journal, utilitaires et formatage
   - src/storage/ : Moteur flash IndexedDB (IDB), cache mémoire (LS), état global (S)
   - src/api/     : Client Apps Script (apiGet/apiPost), delta-sync, synchronisation
   - src/engine/  : Moteur de tournée (planning.js), export WhatsApp (export.js), actions utilisateur (actions.js)
   - src/views/   : Vues spécialisées indépendantes :
                    - accueil.js    : Écrans d'ouverture, sélection identité
                    - jour.js       : Déroulé de la journée, mode Maintenant, synthèse du soir
                    - planifier.js  : Frise agenda, étapes de ciblage, proposition de tournée
                    - produits.js   : Fiches produits et argumentaires
                    - autour.js     : Mode Autour de moi et proximité terrain
                    - equipe.js     : Tournées des collègues et calendrier d'équipe
                    - repertoire.js : Médecins, Pharmacies, Hôpitaux, tri A-Z, défilement infini
                    - suivi.js      : Tableaux de bord, KPIs, couverture et bilans
                    - reglages.js   : Configuration, thèmes et sauvegardes
                    - feuilles.js   : Modales et fiches de saisie du bas
   - src/ui/      : Shell applicatif, barre de navigation, icônes SVG, cycle de vie
   
   Pour générer le bundle de production 'app.js' :
   - En environnement Node.js   : node scripts/build.js (ou npm run build)
   - En environnement Windows   : powershell -ExecutionPolicy Bypass -File scripts/build.ps1
   ============================================================================= */

// Liste ordonnée des modules composant l'application
export const MODULES = [
  'core/utils.js',
  'storage/storage.js',
  'core/format.js',
  'api/api.js',
  'ui/render.js',
  'views/accueil.js',
  'views/jour.js',
  'views/planifier.js',
  'views/produits.js',
  'views/autour.js',
  'views/equipe.js',
  'views/repertoire.js',
  'views/suivi.js',
  'views/reglages.js',
  'views/feuilles.js',
  'engine/export.js',
  'engine/planning.js',
  'engine/actions.js',
  'ui/lifecycle.js'
];
