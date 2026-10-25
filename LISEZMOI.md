# MediPlanner

Version 3.8.9

L'application, installée sur le téléphone, construit la tournée du jour ou de la semaine à partir du **planning propre à chaque médecin**, évite les médecins déjà ciblés par les collègues et envoie le programme validé sur WhatsApp. La base de données est un Google Sheet modifiable depuis l'ordinateur.

```
Téléphones (application)  <-->  Apps Script (serveur, jeton d'accès)  <-->  Google Sheet
  tirage, rattrapage, hors ligne      lecture / écriture, conflits d'équipe       Praticiens, Presences, Plannings,
                                                                                    Historique, Quartiers, Listes
```

- Application : https://sayanla10-alt.github.io/Tournees-Delegue-Medical/ (même adresse et même lien d'installation qu'avant)
- Code : dépôt GitHub `sayanla10-alt/Tournees-Delegue-Medical` (dossier `apps-script/` pour le serveur)

---

## Nouveautés 2.2.0

- Message WhatsApp : une puce devant chaque médecin
- Chaque onglet présente son rôle en une phrase
- Autour : mêmes filtres que Contacts, rayon 2 km et « Maintenant » par défaut, filtre Tout / Médecins / Pharmacies
- Programme validé toujours modifiable (il reste validé pour l'équipe) ; compte rendu enregistré corrigeable
- Tournée : couverture « Jour » et « Couvertes » par défaut ; vos filtres restent mémorisés
- Type de visite : Routine, Réunion, Staff, Déjeuner, Garde ; produits de la gamme en un toucher
- Synchronisation plus fiable : nouvelles tentatives automatiques, aucune saisie perdue
- Formulaires et listes déroulantes modernisés
- Un praticien d'un programme validé par un collègue n'est plus proposé

## La base de données (Google Sheet)

| Feuille | Contenu |
|---|---|
| **Praticiens** | Une ligne par médecin ou pharmacie : CodeContact, Type, Nom, Spécialité, **Note** (3, 2 ou 1, affichée ★★★, ★★ ou ★ dans l'application), **Engagé** (Oui/Non), Téléphone, suivi des visites, Actif |
| **Presences** | Une ligne par **lieu d'exercice** d'un praticien : lieu, quartier, une colonne par jour (**Lundi** à **Vendredi**) contenant *Matin*, *Soir* ou *Matin et soir*, et les horaires du lieu (**HoraireMatin**, ex. `08:00-12:00` ; **HoraireSoir**, ex. `16:00-19:00`). Latitude et Longitude facultatives. |
| **Pharmacies** | Pharmacies réelles d'Abidjan (source OpenStreetMap, menu MediPlanner > Importer les pharmacies réelles) : nom, quartier, commune, zone, latitude, longitude, téléphone quand il est connu ; ouvertes du lundi au vendredi matin (08:00-12:30) et soir (15:00-20:00) ; mêmes colonnes de suivi que Praticiens |
| **Plannings** | Tournées publiées par chaque délégué (tenue à jour par l'application, ne pas modifier) |
| **Historique** | Une ligne par compte rendu de visite, avec le nom du délégué ; colonnes du compte rendu détaillé : Interlocuteur, Réactions, Échantillons, Stocks, Commande, Compléments, Suite |
| **Quartiers** | Quartiers, communes, zones et coordonnées GPS |
| **Listes** | Statuts (Visite faite, puis les motifs de visite non faite) et CompteCommeVisite ; **Activités** (médecins) et **ActivitésPharmacie** ; **Délégués** (noms proposés dans l'application) ; **Activités** (types de visite), **Produits** (gamme proposée en puces dans le compte rendu), **JoursFériés** (exclus des tournées ; ajoutez chaque année les fêtes musulmanes) |

**Potentiel de prescription** : ★★★ = fort (note 3, à voir tous les 14 jours), ★★ = moyen (note 2, 30 jours), ★ = faible (note 1, 60 jours).

**Exemple** : le Dr Kouassi est au CHU de Cocody les mardis et jeudis matin, et dans son cabinet de Marcory les lundis et mercredis soir. Il occupe une ligne dans Praticiens et deux lignes dans Presences :

| CodeContact | Lieu | Quartier | Lundi | Mardi | Mercredi | Jeudi | Vendredi | HoraireMatin | HoraireSoir |
|---|---|---|---|---|---|---|---|---|---|
| MED-012 | CHU de Cocody | Cocody Centre | | Matin | | Matin | | 08:00-12:00 | |
| MED-012 | Cabinet du Dr Kouassi | Zone 4 | Soir | | Soir | | | | 16:00-19:00 |

**Saisie sur ordinateur** :

- Dans Praticiens, un nom saisi sur une nouvelle ligne reçoit automatiquement son CodeContact (MED-… ou PHA-…).
- Dans Presences, choisir le CodeContact remplit le Nom ; choisir le quartier remplit Commune et Zone. Les cases des jours ont une liste déroulante, et les saisies rapides M, S et MS sont aussi comprises.
- Pour retirer un praticien sans perdre son historique, passez Actif à « Non ».

**Menu MediPlanner du Sheet** :

- Initialiser le classeur
- Régénérer la base fictive (environ 600 praticiens, pour une équipe de 10 délégués)
- Convertir l'ancienne feuille BaseDonnees
- Compléter les données manquantes (base de test) : téléphones fictifs en +225 00 … (aucun vrai numéro), dernier statut, commentaire et nombre de visites des praticiens déjà visités, coordonnées GPS des établissements. Ne pas utiliser sur une vraie base.
- Afficher ou changer le jeton d'accès

---

## Nouveautés de la version 2.0.0

- **Écran d'accueil** à l'ouverture : version, état de la base (« Base de données opérationnelle », « Hors ligne : données locales »…), nombre de médecins et de pharmacies, visites planifiées de la semaine. Boutons **Accéder au tableau de bord** et **Lancer l'application** ; sans action, la tournée s'ouvre seule après 5 secondes (10 secondes après une mise à jour, le temps de lire les nouveautés, affichées une seule fois). Toucher l'écran d'accueil arrête le décompte.
- **Stats** (nouvel onglet) : taux de couverture (visites faites sur visites prévues échues), visites réalisées et taux de présence, atteinte de l'objectif (visites par semaine, réglable), part des praticiens ★★★ vus dans les 14 jours, activité par jour, par commune et par spécialité. Filtres Jour, Semaine, Mois, Personnalisé, et Moi / Équipe. Chaque graphique a son tableau de données.
- **Filtres avancés cumulables** (Contacts > Filtres) : type, potentiel ★ à ★★★, dernière visite (non visité depuis +30 j, à revoir, jamais visité, en retard, visité récemment), engagé, ciblé par un collègue, spécialités, communes. La recherche couvre nom, spécialité, établissement et quartier. Tri par potentiel, priorité, dernière visite ou nom.
- **Fiche praticien en 4 étapes** (Contacts > + Praticien, ou Modifier la fiche) : informations, spécialité et potentiel, disponibilités par lieu, localisation (quartier et GPS facultatif). Les erreurs sont signalées champ par champ. La fiche s'enregistre hors ligne et part dans le Google Sheet au retour du réseau (code MED-/PHA- attribué par le serveur).
- **Tournée** : praticiens ciblés (avec ou sans pharmacies, ou pharmacies seules), spécialités ciblées en choix multiple, potentiels ciblés. Pour chaque jour : premier RDV, fin estimée, durée de la journée et temps de route, et un bouton **Itinéraire du jour dans l'ordre optimal** (Google Maps).
- **Actions rapides** sur chaque visite et chaque contact : Appeler, SMS (si le téléphone est renseigné), Waze, Google Maps.
- **Apparence** (Réglages) : Clair (par défaut), Sombre ou Auto.
- **Filtres** : puces cochées, recherche dans les longues listes (spécialités, communes), groupes repliables, boutons Tout / Effacer / Toute la zone, filtres rapides en un toucher dans Contacts (★★★, non visité +30 j, à revoir, jamais visité, engagés, pharmacies). Sur tablette, les fenêtres de choix s'ouvrent au centre de l'écran.
- **Tournée** : par défaut sans pharmacies.
- **Mises à jour** : quand une nouvelle version est publiée, un bandeau « Mise à jour disponible » avec les nouveautés apparaît ; **Mise à jour** recharge l'application dans la nouvelle version. Les données du téléphone (tournée, comptes rendus en attente, réglages) sont conservées. Les téléphones encore sur l'ancienne application passent automatiquement en 2.0.0 à leur prochaine ouverture.

## Nouveautés de la version 2.1.0

- **Pharmacies réelles** dans une feuille séparée (environ 530 pharmacies recensées sur OpenStreetMap ; la carte libre n'est pas exhaustive : ajoutez les manquantes dans la feuille ou depuis l'application).
- **Jours fériés** signalés dans la préparation de la tournée, Autour de moi et l'écran d'accueil, d'après le calendrier officiel de la Côte d'Ivoire (date.nager.at) ; les fêtes musulmanes se saisissent dans Listes > JoursFériés.
- **Type de visite** (routine / rappel, présentation produit, EPU, échantillons, réunion…) : liste modifiable dans Listes > Activités ; colonne Activité dans Historique ; graphique dans Stats.
- **WhatsApp** remplace Waze dans les actions rapides.
- **Cartes** modernes (fond OpenStreetMap épuré) : itinéraire numéroté du jour, visites de l'équipe, communes non couvertes ; tournée d'un collègue dans Équipe.
- **Validation du programme** : l'envoi sur WhatsApp est proposé, pas imposé ; le nom de chaque établissement est en gras dans le message.

## Nouveautés de la version 2.0.6

- **Compte rendu** : produits présentés (les produits déjà saisis sont proposés) et **prochaine étape** (+7 j, +14 j, +30 j ou une date). À cette date, le praticien remonte en priorité dans les tournées et apparaît dans le filtre « À revoir ». Colonnes Produits et ProchaineEtape dans Historique, ProchaineEtape dans Praticiens.
- **Temps de trajet** : plus lents aux heures de pointe (7 h-9 h 30, 16 h 30-19 h 30) et 10 minutes de plus pour traverser la lagune (Plateau, Cocody… vers Treichville, Marcory, Koumassi, Port-Bouët).
- **Jours fériés** (feuille Listes) exclus des tournées ; **absences des praticiens** (colonnes AbsentDu / AbsentAu, ou fiche praticien dans l'application) respectées.
- **Fiabilité des lieux** : un lieu où le praticien a été absent à au moins 40 % des visites (sur 3 comptes rendus ou plus) est signalé « Souvent absent ici » et proposé après les autres.
- **Nom du délégué** choisi dans la liste de la feuille Listes (colonne Délégués), pour éviter les fautes de frappe entre collègues.
- **Historique** regroupé dans l'onglet Stats ; 5 onglets au lieu de 6.
- **Synchronisation allégée** : si la base n'a pas changé, seules les nouvelles visites et les tournées sont téléchargées.

## Utilisation sur le téléphone (version 3)

L'application suit la journée du délégué, en 5 onglets.

**1. Aujourd'hui** (sur le terrain)
- Les visites du jour dans l'ordre de passage (les praticiens d'un même établissement à la suite, puis les établissements de proche en proche depuis votre point de départ, sans dépasser les horaires de présence), l'heure de la première visite, la fin estimée et l'**itinéraire de la journée**.
- Touchez une visite : **Appeler, SMS, WhatsApp, Maps**, puis le compte rendu, **une question à la fois** (la suivante n'apparaît qu'après la réponse ; les réponses données restent en lignes courtes, touchez-en une pour la modifier ; étapes à choix multiple ou à saisie : **Continuer**, étapes facultatives : **Passer**). L'arbre de décision commence par **« La visite a-t-elle été faite ? Oui / Non »** :
  - **Médecin, Oui** : type(s) de visite → produits présentés ? (avec « Autres produits ») → réaction par produit (intéressé, indécis, non intéressé, demande d'informations, non évalué) → échantillons remis ? (quantités) → bilan facultatif → suite.
  - **Pharmacie, Oui** : interlocuteur → activité(s) → stocks vérifiés ? (par produit : en stock, stock faible, rupture, non référencé, non vérifié ; quantité ; proche péremption ou périmé avec n° de lot) → commande passée ? (quantités, sinon besoin de réapprovisionnement) → compléments selon l'activité (échantillons, retour ou échange, PLV / formation / animation) → commentaire → suite.
  - **Non** : motif → précision facultative → trouver un remplaçant à proximité ? (Oui : enregistre la visite non faite et ouvre Autour de moi) → suite. Produits, stocks et discussion sont masqués.
  - Une question déjà réglée par les activités n'est pas reposée (Présentation produit, Échantillons, Stocks, Commande).
  - **Suite** : rappel ou **RDV confirmé** avec date (+7 j, +14 j, +30 j ou calendrier). Seul un RDV confirmé ajoute la visite à la tournée ; un rappel s'affiche le jour venu dans « Aujourd'hui ». Une commande ne modifie pas le stock avant réception.
- **Enregistrer le compte rendu** ; un compte rendu enregistré se **modifie** à tout moment.
- Visite non faite : **Trouver un remplaçant à proximité** ouvre « Autour de moi » centré sur ce lieu.
- **Pharmacie** (bouton en haut) : les pharmacies ouvertes près de votre position, à ajouter à la tournée du jour.
- Planifier : bouton **Planifier** ; la planification de la tournée se fait une option à la fois **Période > Communes ciblées > Praticiens à visiter > Spécialités > Potentiel > Rythme de visite > RDV et prioritaires** ; chaque réponse se replie en une ligne modifiable, puis « Proposer ma tournée ».
- Équipe : touchez un ou plusieurs délégués pour les isoler ; « Toute l'équipe » les affiche tous, un bloc repliable par délégué.
- Recherche : un résumé des critères et un bouton **Recherche** qui les déploie ; **Fermer la recherche** les replie.
- Recherche et Autour de moi : filtres dans l'ordre des questions **Qui ? > Quelle spécialité ? > Où ? > Quelle valeur ? > Quel suivi ? > Dans quel ordre ?**. Une seule question à la fois, comme le compte rendu ; chaque réponse se replie en une ligne modifiable, puis une ligne « Critères » résume tout. Les raccourcis (★★★, Non visité +30 j, À revoir, Jamais visité, Engagés) sont proposés à la première question.
- Aujourd'hui : **+ Médecin** (médecins présents près de vous, selon vos spécialités), **+ Pharmacie** et **Autour de moi**, sur une même ligne. Le jour choisi reste affiché après un rafraîchissement.
- Médecin déjà prévu par un collègue : la carte demande **« Le remplacer ? »** ; Oui affiche les praticiens disponibles ce jour-là (pré-filtrés selon vos critères et les horaires), vous choisissez puis confirmez ; Non le garde. Toute modification de la tournée (retirer, ajouter, remplacer) demande une confirmation.
- **Autour de moi** (bouton en haut) : qui est présent maintenant ou à un autre moment, près de vous ou d'un quartier, avec les mêmes filtres que Praticiens.

**2. Planifier** (la préparation)
- **Planifier** : une journée ou une semaine, communes (différentes selon le jour si besoin), Tout / Médecins / Pharmacies, spécialités, potentiel, visites par jour, « ne pas revoir avant », éviter les médecins prévus par un collègue.
- **RDV et médecins prioritaires** : placés d'office, la tournée se construit autour d'eux.
- **Reprendre un ancien programme** : choisissez une semaine ou un jour des 8 dernières semaines, puis **le jour ou la semaine sur lesquels le copier**. Il est copié en brouillon (praticiens absents ce jour-là signalés) ; un bandeau propose alors **Conserver** ou **Revenir à l'ancienne** planification.
- **Proposer ma tournée**, puis jour par jour : **Garder** un médecin, le **retirer**, **Recalculer ce jour** ou **la semaine** (les médecins gardés, les RDV et les visites faites restent).
- **Confirmer la tournée** : elle devient visible par l'équipe ; elle reste modifiable et chaque changement est publié. **Envoyer sur WhatsApp** : « Planning du … (votre nom) », puis chaque établissement et ses médecins, précédés d'une puce.
- **Communes visitées** : carte et liste des communes visitées ou non (par vous et par l'équipe), au jour ou à la semaine.

**3. Recherche** (les praticiens) : recherche, une phrase qui résume les critères retenus, Tout / Médecins / Pharmacies, filtres rapides et avancés, tri. La fiche affiche les actions rapides, le dernier commentaire, le prochain RDV et les jours de présence (touchez M ou S pour planifier) ; **Ajouter à ma tournée** ou **Modifier la fiche** ; **Ajouter** pour créer une fiche en 4 étapes.

**4. Équipe** : choisissez **Jour** ou **Semaine**, puis la date (flèches ou calendrier) : pour vous et chaque collègue, ce qui a été planifié et ce qui a été fait (visites faites, non faites, sans compte rendu, hors tournée), avec « Toute l'équipe » pour tout voir ensemble, le détail de chaque visite (type, produits, commentaire) et la carte du jour en bas. Tournées conservées 62 jours.

**5. Bilan** : tableau de bord (taux de réalisation, visites réalisées, objectif, praticiens ★★★ à jour, activité par jour, par commune, par spécialité, par type de visite, par délégué) et **Historique** de toutes les visites.

Les listes de la feuille Listes (produits, activités, statuts, délégués) sont relues chaque minute : un produit retiré disparaît des comptes rendus sans attendre.

**Réglages** (roue dentée) : profil, apparence, partage, installation, mises à jour ; **Avancé** : connexion au Google Sheet, synchronisation, démonstration, effacement des données.

La pastille en haut à droite indique l'état de la synchronisation ; touchez-la pour synchroniser.

---

## Travail en équipe (jusqu'à 10 délégués et plus)

- Chaque tournée générée ou modifiée est publiée dans la feuille Plannings.
- Un médecin prévu par un collègue porte l'étiquette « Prévu par [nom] » (tournée confirmée) ou « Envisagé par [nom] » (brouillon). Un médecin d'une tournée confirmée par un collègue n'est jamais proposé.
- **Premier arrivé, premier servi** : si deux délégués tirent le même médecin pour la même semaine, le second voit ce médecin remplacé automatiquement. Les médecins épinglés, imposés ou déjà visités sont seulement signalés.
- Test réalisé : 10 délégués lançant leur tirage au même instant ont obtenu 400 visites sans aucun médecin en double.

---

## Installation et maintenance

- **Serveur** : coller `apps-script/Code.gs` et `apps-script/Commun.gs` dans Extensions > Apps Script du Sheet. Ensuite, **Déployer > Gérer les déploiements**, crayon, **Nouvelle version**, **Déployer**. L'URL reste la même.
- **Application** : les fichiers à la racine du dépôt sont servis par GitHub Pages. Pour publier une version : changer `VERSION` dans `sw.js`, `APP_VERSION` dans `app.js` et le contenu de `version.json` (numéro et nouveautés affichées dans le bandeau).
- **Jeton** : MediPlanner > Changer le jeton d'accès, puis renvoyer le lien d'installation (Réglages > Partager l'application).
- `commun.js` et `apps-script/Commun.gs` doivent rester identiques.

## Limites

- Les distances sont estimées à vol d'oiseau × 1,3, avec environ 3 min/km. Le trafic réel aux heures de pointe n'est pas pris en compte.
- Les coordonnées des quartiers sont approximatives. Pour un établissement précis, renseignez Latitude et Longitude dans Presences.
- Les signalements d'équipe dépendent de la synchronisation : un délégué resté hors ligne ne voit les choix des autres qu'à son retour sur le réseau.
