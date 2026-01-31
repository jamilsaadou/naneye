# Hierarchie utilisateurs & reductions

Ce document decrit l'ajout d'un superieur hierarchique et le flux de validation des reductions.
La logique actuelle est conservee : seuls les roles **ADMIN** et **SUPER_ADMIN** peuvent creer des reductions.

## 1) Superieur hierarchique
- Chaque utilisateur peut avoir un `supervisorId` (optionnel).
- Le superieur doit etre **ADMIN** ou **SUPER_ADMIN**.
- Regle de portee :
  - Si l'utilisateur est dans une commune, le superieur doit etre **dans la meme commune** ou **global**.
  - Si l'utilisateur est global, le superieur doit etre **global**.

**Configuration**
- Menu: **Administration > Utilisateurs**
- Champ: **Superieur hierarchique**

## 2) Reduction avec approbation
### Cas 1 : utilisateur SANS superieur
- La reduction est appliquee immediatement.
- Statut : **APPROVED**

### Cas 2 : utilisateur AVEC superieur
- La reduction est creee en **PENDING**.
- Aucune modification de la facture tant que ce n'est pas approuve.

## 3) Menus reductions
Dans le menu **Reductions** :
- **Mes demandes** : liste des demandes de l'utilisateur (PENDING/APPROVED/REJECTED)
- **Demandes a approuver** : visible uniquement si l'utilisateur a des subordonnes

## 4) Approbation / Rejet
- Le superieur voit les demandes PENDING de ses subordonnes.
- Il peut **Approuver** ou **Rejeter** avec une note optionnelle.
- Lors de l'approbation :
  - la facture est mise a jour,
  - la reduction passe en **APPROVED**,
  - un log d'audit est ajoute.

## 5) Endpoints internes
- `POST /reductions` (action server) : creation de demande ou application directe
- `POST /reductions/approvals` (action server) : approbation/rejet

## 6) Notes importantes
- Les tableaux de bord et l'historique affichent uniquement les reductions **APPROVED**.
- Les demandes **PENDING** n'affectent pas les totaux.
