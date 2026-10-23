# MediPlanner v2.0.1 Enterprise (anciennement « Tournées »)

L'application, installée sur le téléphone, construit la tournée du jour ou de la semaine à partir du **planning propre à chaque médecin**, évite les médecins déjà ciblés par les collègues et envoie le programme validé sur WhatsApp. La base de données est un Google Sheet modifiable depuis l'ordinateur.

```
Téléphones (application)  <-->  Apps Script (serveur, jeton d'accès)  <-->  Google Sheet
  tirage, rattrapage, hors ligne      lecture / écriture, conflits d'équipe       Praticiens, Presences, Plannings,
                                                                                    Historique, Quartiers, Listes
```

- Application : https://sayanla10-alt.github.io/Tournees-Delegue-Medical/ (même adresse et même lien d'installation qu'avant)
- Code : dépôt GitHub `sayanla10-alt/Tournees-Delegue-Medical` (dossier `apps-script/` pour le serveur)

---

## La base de données (Google Sheet)

| Feuille | Contenu |
|---|---|
| **Praticiens** | Une ligne par médecin ou pharmacie : CodeContact, Type, Nom, Spécialité, **Note** (3, 2 ou 1, affichée ★★★, ★★ ou ★ dans l'application), **Conventionné** (Oui/Non), Téléphone, suivi des visites, Actif |
| **Presences** | Une ligne par **lieu d'exercice** d'un praticien : lieu, quartier, une colonne par jour (**Lundi** à **Vendredi**) contenant *Matin*, *Soir* ou *Matin et soir*, et les horaires du lieu (**HoraireMatin**, ex. `08:00-12:00` ; **HoraireSoir**, ex. `16:00-19:00`). Latitude et Longitude facultatives. |
| **Plannings** | Tournées publiées par chaque délégué (tenue à jour par l'application, ne pas modifier) |
| **Historique** | Une ligne par compte rendu de visite, avec le nom du délégué |
| **Quartiers** | Quartiers, communes, zones et coordonnées GPS |
| **Listes** | Statuts de visite et ceux qui comptent comme visite effective |

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
- Afficher ou changer le jeton d'accès

---

## Nouveautés de la version 2.0.0

- **Écran d'accueil** à l'ouverture : version, état de la base (« Base de données opérationnelle », « Hors ligne : données locales »…), nombre de médecins et de pharmacies, visites planifiées de la semaine. Boutons **Accéder au tableau de bord** et **Lancer l'application**.
- **Stats** (nouvel onglet) : taux de couverture (visites faites sur visites prévues échues), visites réalisées et taux de présence, atteinte de l'objectif (visites par semaine, réglable), part des praticiens ★★★ vus dans les 14 jours, activité par jour, par commune et par spécialité. Filtres Jour, Semaine, Mois, Personnalisé, et Moi / Équipe. Chaque graphique a son tableau de données.
- **Filtres avancés cumulables** (Contacts > Filtres) : type, potentiel ★ à ★★★, dernière visite (non visité depuis +30 j, à revoir, jamais visité, en retard, visité récemment), conventionné, ciblé par un collègue, spécialités, communes. La recherche couvre nom, spécialité, établissement et quartier. Tri par potentiel, priorité, dernière visite ou nom.
- **Fiche praticien en 4 étapes** (Contacts > + Praticien, ou Modifier la fiche) : informations, spécialité et potentiel, disponibilités par lieu, localisation (quartier et GPS facultatif). Les erreurs sont signalées champ par champ. La fiche s'enregistre hors ligne et part dans le Google Sheet au retour du réseau (code MED-/PHA- attribué par le serveur).
- **Tournée** : praticiens ciblés (avec ou sans pharmacies, ou pharmacies seules), spécialités ciblées en choix multiple, potentiels ciblés. Pour chaque jour : premier RDV, fin estimée, durée de la journée et temps de route, et un bouton **Itinéraire du jour dans l'ordre optimal** (Google Maps).
- **Actions rapides** sur chaque visite et chaque contact : Appeler, SMS (si le téléphone est renseigné), Waze, Google Maps.
- **Apparence** (Réglages) : Auto, Clair ou Sombre.
- **Mises à jour** : quand une nouvelle version est publiée, un bandeau « Mise à jour disponible » avec les nouveautés apparaît ; **Mise à jour** recharge l'application dans la nouvelle version. Les données du téléphone (tournée, comptes rendus en attente, réglages) sont conservées. Les téléphones encore sur l'ancienne application passent automatiquement en 2.0.0 à leur prochaine ouverture.

## Utilisation sur le téléphone

**Tournée**

1. **Préparer** : une journée ou une semaine ; **communes ciblées en choix multiple** (et, en semaine, des secteurs différents selon les jours) ; nombre de visites par jour ; délai minimum depuis la dernière visite.
2. **À voir absolument** : recherchez un médecin et ajoutez-le, avec un jour de présence et une heure de RDV facultatifs. La tournée est construite autour de lui.
3. **Lancer le tirage** : l'application récupère d'abord les tournées des collègues, écarte les médecins qu'ils ciblent déjà cette semaine, puis construit chaque journée :
   - les médecins sont choisis selon leur note et leur retard de visite ;
   - ils sont regroupés géographiquement ;
   - l'ordre de passage respecte leurs fenêtres de présence (trajet d'environ 3 min/km, visite de 20 min).
4. **Nouveau tirage** : épinglez les médecins à conserver, puis touchez **Nouveau tirage** (jour) ou **Semaine entière**. Les médecins non épinglés sont remplacés par d'autres.
5. **Valider le programme** : le programme est publié auprès de l'équipe et la fenêtre d'envoi s'ouvre. **Envoyer sur WhatsApp** l'envoie à votre numéro (Réglages), avec WhatsApp Web sur ordinateur et l'application WhatsApp sur téléphone. Le message est court : pour chaque jour, le médecin, sa spécialité, l'établissement et le secteur.
6. **Sur le terrain** : touchez un médecin, choisissez le résultat de la visite et ajoutez un commentaire, puis **Enregistrer les comptes rendus**. Si le médecin est absent, **Absent : remplacer** ouvre « Autour de moi » centré sur ce lieu.
7. **Couverture** : sous la tournée, une carte et la liste des communes couvertes et non couvertes (par vous ou par un collègue), avec un bouton pour passer de **Jour** à **Semaine**.

**Autour de moi** : les médecins présents **maintenant** (ou à l'heure choisie) autour de votre position GPS ou d'un quartier, dans un rayon de 2 à 20 km, d'après leur propre planning, avec un bouton pour les ajouter à la tournée.

**Équipe** : la tournée de chaque collègue (proposition ou programme validé), rafraîchie toutes les 2 minutes.

**Contacts** : recherche et filtres avancés (voir ci-dessus). La fiche d'un médecin affiche les actions rapides et son planning de la semaine ; touchez M ou S pour planifier une visite, ajoutez-le à « À voir absolument » ou modifiez sa fiche.

**Réglages** : votre nom, votre numéro WhatsApp, l'option WhatsApp Web, votre point de départ habituel, et le lien d'installation à partager avec un collègue.

---

## Travail en équipe (jusqu'à 10 délégués et plus)

- Chaque tournée générée ou modifiée est publiée dans la feuille Plannings.
- Un médecin ciblé par un collègue porte l'étiquette « Ciblé par [nom] » (programme validé) ou « Envisagé par [nom] » (proposition).
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
