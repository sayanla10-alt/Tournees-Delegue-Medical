# Guide de Transition Douce : Google Sheets -> Supabase

Ce dossier contient tous les éléments nécessaires pour créer et alimenter votre base de données cloud **Supabase**, **sans modifier ni perturber le fonctionnement actuel de votre Google Sheet**.

---

## Étape 1 : Créer votre projet Supabase (2 minutes, gratuit)

1. Rendez-vous sur [supabase.com](https://supabase.com) et créez un compte gratuit.
2. Cliquez sur **« New Project »** :
   - **Nom** : `mediplanner`
   - **Mot de passe base de données** : Choisissez un mot de passe sécurisé.
   - **Région** : Choisissez **Europe (Paris / eu-west-3)** ou **Europe (Frankfurt / eu-central-1)** pour une latence optimale avec l'Afrique de l'Ouest.
   - **Plan** : Free (Gratuit à 0 €/mois).
3. Cliquez sur **« Create new project »** et attendez 1 minute que les serveurs soient prêts.

---

## Étape 2 : Créer les tables (1 clic)

1. Dans votre tableau de bord Supabase, cliquez sur **« SQL Editor »** dans le menu de gauche (icône `>_`).
2. Cliquez sur **« New query »**.
3. Ouvrez le fichier local [`schema.sql`](./schema.sql), copiez **l'intégralité de son contenu** et collez-le dans l'éditeur Supabase.
4. Cliquez sur le bouton vert **« Run »** en bas à droite.
5. Vos tables (`praticiens`, `presences`, `pharmacies`, `visites`, `plannings`, `rapports`) sont instantanément créées avec leurs index et leurs sécurités.

---

## Étape 3 : Cloner vos données Google Sheets vers Supabase (Sans risque)

1. Ouvrez votre classeur Google Sheets habituel.
2. Vous verrez un nouveau sous-menu dans **MediPlanner** :
   👉 **`MediPlanner` > `Base Cloud Supabase` > `Configurer les identifiants Supabase`**
3. Renseignez :
   - L'URL de votre projet (disponible dans Supabase > Settings > API, ex: `https://xyzcompany.supabase.co`).
   - La clé d'API publique (`anon key` ou `service_role`).
4. Cliquez ensuite sur :
   👉 **`MediPlanner` > `Base Cloud Supabase` > `Cloner Google Sheets vers Supabase (Copie miroir)`**
5. Le script Apps Script va lire toutes vos fiches et les insérer dans Supabase en quelques secondes.

---

## Étape 4 : Constater et valider

Ouvrez l'onglet **Table Editor** sur Supabase :
Vous voyez tous vos médecins et leurs lieux de consultation apparaître dans le beau tableau visuel.

**Important** : Vos délégués et votre application continuent de fonctionner à 100 % sur Google Sheets comme d'habitude. Rien n'est cassé. Quand vous serez parfaitement rassuré par l'interface et la rapidité de Supabase, nous pourrons activer la bascule en 1 clic !
