# RÈGLES ET DIRECTIVES STRICTES DU PROJET MEDIPLANNER

Ce document consigne les directives fermes et les interdictions absolues établies par l'utilisateur pour le développement de l'application MediPlanner. Tout agent intervenant sur ce projet DOIT respecter ces règles sans exception.

---

## 1. CHARTE GRAPHIQUE & COULEURS : INTERDICTION FORMELLE DU ROUGE
* **ZÉRO bouton rouge** : Ne JAMAIS utiliser de couleur rouge (`#c0392b`, `#B3362E`, `red`, etc.) pour les boutons d'action, de confirmation, de suppression ou de réinitialisation. Le rouge détonne et casse l'harmonie de la charte graphique médicale.
* **Charte officielle** : Tous les boutons principaux (y compris « Supprimer la journée » ou « Réinitialiser ») doivent impérativement utiliser la couleur sarcelle / turquoise médicale officielle (`var(--primaire)`, `#0A6C74`, classe `bouton-plein`) ou des tons neutres sobres (`var(--papier-2)`, `var(--gris)`).
* **Animations d'appui long** : Les effets visuels de pression (`.appui-long-actif`) doivent utiliser les nuances sarcelle (`var(--primaire)` et `rgba(10, 108, 116, .25)`), JAMAIS de bordure ou de halo rouge.

---

## 2. INTERDICTION DES BOUTONS POUBELLE / CORBEILLE
* **Aucune icône poubelle** : Ne jamais ajouter de bouton corbeille ou poubelle (`btn-suppr-jour`, icône poubelle) sur l'écran ou dans la barre de titre de planification.
* **Suppression de date** : La suppression d'une date planifiée s'opère **exclusivement par appui long tactile (~650 ms)** sur la date dans la frise ou sur le bandeau titre du jour, suivi de la boîte de dialogue modale de confirmation.

---

## 3. INTERDICTION DES ÉLÉMENTS IA
* **Aucun bouton Copilote IA** : Tout composant d'IA interactive (bouton d'aide IA, bulle flottante, modal IA) a été définitivement supprimé à la demande de l'utilisateur et ne doit JAMAIS être réintroduit.

---

## 4. BOUTON DE SYNCHRONISATION
* **Libellé complet préservé** : Le bouton de synchronisation dans l'en-tête doit obligatoirement conserver son texte complet (« À jour », « Synchro… », « Hors ligne ») et son comportement d'origine. Ne jamais le réduire à un simple voyant ou une puce.

---

## 5. NOMS DES PRATICIENS INTÉGRAUX (PAS DE TRONCATURE)
* **Zéro coupure** : Les noms des praticiens (médecins, pharmaciens) ne doivent JAMAIS être tronqués ni masqués par des points de suspension (`...`). Ils doivent toujours s'afficher en entier (`overflow: visible`, `white-space: normal`).

---

## 6. MISE EN PAGE COMPACTE DANS L'ONGLET PLANIFIER
* **Bandeau Communes visitées sur une seule ligne** : L'en-tête comportant « Communes visitées », le compteur (ex. `2/8`), le chevron dépliant et le sélecteur `[Jour | Sem.]` doit être verrouillé sur **une seule ligne strictly non-wrap** (`flex-wrap: nowrap !important`) pour préserver l'espace vertical.

---

## 7. VOCABULAIRE & PHRASES D'INTRODUCTION
* **Répertoire** : Utiliser impérativement la formule **« Tous vos contacts »** (et non « Tous vos médecins et pharmacies »).
* **Phrases d'introduction des onglets** : Doivent rester concises, sobres et tenir sur 2 lignes maximum.
