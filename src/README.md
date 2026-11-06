# Architecture modulaire de MediPlanner (`src/`)

Pour répondre à la dette technique du monolithe de 11 500 lignes, le code de `app.js` est désormais découpé en modules spécialisés et découplés :

```
src/
├── core/
│   ├── utils.js        # Constantes, journal de versions, utilitaires de chaînes/dates, accessibilité
│   └── format.js       # Formatage des dates, badges, téléphones, étoiles et hôpitaux
├── storage/
│   └── storage.js      # Moteur flash IndexedDB (IDB), cache mémoire synchrone (LS), état global (S), contextes (ctx)
├── api/
│   └── api.js          # Client Google Apps Script, synchronisation incrémentale Delta (syncedAt), files d'attente
├── engine/
│   └── engine.js       # Moteur de planification, calculs d'itinéraires, gestion des arrêts, actions utilisateur
├── views/
│   ├── views.js        # Vues principales : Journée, Planifier, Répertoire, Produits, Suivi, Équipe, Réglages, CR visite
│   └── feuilles.js     # Fenêtres modales et feuilles de saisie du bas : Ajouter, Filtres, Fiche praticien
├── ui/
│   ├── render.js       # Shell d'affichage, en-tête persistant, barre de navigation, orchestrateur de rendu
│   └── lifecycle.js    # Bibliothèque d'icônes SVG, thèmes, splash screen, service worker et démarrage
└── main.js             # Manifeste des composants et point d'entrée modulaire
```

---

## Commandes de construction (`build`)

Pour compiler ou assembler les modules dans le bundle de production `app.js` :

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

## Avantages de cette architecture
1. **Fini le monolithe** : Chaque fichier se concentre sur un seul domaine métier (300 à 1 500 lignes au lieu de 12 000).
2. **Élimination des effets de bord** : Modifier une fonction de stockage ou une vue n'altère pas les calculs du moteur.
3. **Tests unitaires ciblés** : Les modules `storage.js`, `api.js` et `format.js` peuvent être testés isolément.
4. **Zéro régression en production** : L'assemblage produit un fichier `app.js` strictement identique et 100 % compatible avec le Service Worker PWA, l'APK Android et GitHub Pages.
