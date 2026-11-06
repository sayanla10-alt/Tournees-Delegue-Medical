# Architecture modulaire de MediPlanner (`src/`)

L'application MediPlanner est intégralement découpée en **composants et modules métier indépendants** pour garantir une maintenance aisée, éliminer les risques d'effets de bord et permettre des évolutions rapides :

```
src/
├── core/
│   ├── utils.js        # Constantes, version, journal, utilitaires de chaînes/dates, accessibilité
│   └── format.js       # Formatage des dates, badges, téléphones, étoiles et hôpitaux
├── storage/
│   └── storage.js      # Moteur flash IndexedDB (IDB), cache mémoire synchrone (LS), état global (S), contextes (ctx)
├── api/
│   └── api.js          # Client Google Apps Script, synchronisation incrémentale Delta (syncedAt), files d'attente
├── views/
│   ├── accueil.js      # Écrans d'ouverture, chargement et sélection délégué
│   ├── jour.js         # Déroulé de la journée, mode Maintenant, synthèse du soir (18h30)
│   ├── planifier.js    # Frise agenda, étapes de ciblage, proposition de tournée
│   ├── produits.js     # Fiches produits, arguments, posologies
│   ├── autour.js       # Recherche autour de moi, rayon et proximité
│   ├── equipe.js       # Tournées partagées des collègues et calendrier d'équipe
│   ├── repertoire.js   # Répertoire Médecins, Pharmacies, Hôpitaux, tri A-Z, défilement infini
│   ├── suivi.js        # Tableaux de bord, KPIs, couverture, bilans de visites
│   ├── reglages.js     # Réglages, thèmes clair/sombre, jeton, sauvegardes
│   └── feuilles.js     # Feuilles de saisie et fenêtres modales du bas
├── engine/
│   ├── export.js       # Export de tournée, partage WhatsApp, intents natifs
│   ├── planning.js     # Algorithmes de tournée, génération du planning, gestion des arrêts et cadences
│   └── actions.js      # Gestionnaire d'actions utilisateur (ACTIONS dispatcher)
├── ui/
│   ├── render.js       # Shell d'affichage, en-tête persistant, jauge tactile, barre de navigation
│   └── lifecycle.js    # Bibliothèque d'icônes SVG, splash screen, service worker et démarrage
└── main.js             # Manifeste des composants et point d'entrée modulaire
```

---

## Commandes de construction (`build`)

Pour assembler les 19 modules indépendants dans le bundle de production `app.js` :

### Sous Windows (PowerShell) :
```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

### Avec Node.js :
```bash
node scripts/build.js
# ou
npm run build
```

---

## Avantages de cette architecture modulaire
1. **Zéro fichier monolithique** : Fini le fichier de 12 000 lignes. Chaque composant fait entre 100 et 1 500 lignes claires.
2. **Indépendance des responsabilités** : Modifier une vue (ex. Répertoire ou Journée) ne risque pas d'altérer le calcul des tournées ou le stockage IndexedDB.
3. **Évolution rapide et sûre** : Ajout ou refonte de composants isolés sans risque de régression.
4. **Zéro régression en production** : L'assemblage produit un fichier `app.js` 100 % compatible PWA hors-ligne, Service Worker et mobile.
