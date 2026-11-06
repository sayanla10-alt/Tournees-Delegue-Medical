/* =============================================================================
   src/main.js : Point d'entrée de l'architecture modulaire de MediPlanner
   
   Architecture découplée en 6 domaines métier :
   - src/core/    : Constantes, version, journal, utilitaires et formatage
   - src/storage/ : Moteur flash IndexedDB (IDB), cache mémoire (LS), état global (S)
   - src/api/     : Client Apps Script (apiGet/apiPost), delta-sync, synchronisation
   - src/engine/  : Moteur de tournée, scoring, tri, gestion des arrêts et géolocalisation
   - src/views/   : Vues principales (VUES) et feuilles de saisie / modales (FEUILLES)
   - src/ui/      : Shell applicatif, icônes SVG, gestionnaire d'événements ACTIONS, cycle de vie
   
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
  'views/views.js',
  'views/feuilles.js',
  'engine/engine.js',
  'ui/lifecycle.js'
];
