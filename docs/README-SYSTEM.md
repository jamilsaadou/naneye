# Plateforme Gestion des Taxes — Readme de presentation (PPT-ready)

Ce document sert de base pour un **tutoriel utilisateurs** et une **presentation PowerPoint**. Il explique le fonctionnement global, le workflow metier, les modules, et le parcours type d'un utilisateur.

---

## 1) Messages cles (pour la presentation)
- Une plateforme unique pour gerer **contribuables, taxes, avis, paiements et rapports**.
- Un workflow clair: **Configurer → Creer contribuables → Generer avis → Encaisser → Suivre & auditer**.
- Deux modes d'encaissement: **interne** (caisse) et **collecteurs externes** (API securisee).
- Trace et audit complet via le **Journal API**.

---

## 2) Plan de slides (structure recommandee)
1. **Titre & contexte**: Pourquoi digitaliser la gestion des taxes.
2. **Problemes resolus**: dispersion des donnees, suivi difficile, retard de recouvrement.
3. **Solution**: vue d'ensemble de la plateforme.
4. **Acteurs & roles**: qui fait quoi.
5. **Modules principaux**: contribuables, taxes, avis, paiements, rapports, audit.
6. **Workflow metier global** (schema simple).
7. **Parcours utilisateur interne** (caisse).
8. **Parcours collecteur externe** (API).
9. **Donnees cles & identifiants** (noticeNumber, taxpayerCode).
10. **Suivi & reporting** (etats, exports, historique).
11. **Securite & conformite** (roles, JWT, idempotence).
12. **Demo / scenario** (exemple concret).
13. **Conclusion** (benefices + prochaines etapes).

---

## 3) Vue d'ensemble du systeme
La plateforme permet de:
- Gerer les contribuables (informations, statut, localisation).
- Configurer les taxes, categories et regles.
- Generer des avis d'imposition.
- Encaisser des paiements (interne ou via collecteurs).
- Suivre l'historique, les rapports et les journaux (audit / API).

**Technos (pour transparence)**
- Frontend/Backend: Next.js
- Base de donnees: PostgreSQL
- ORM: Prisma
- API collecteurs: JWT (HS256)

---

## 4) Modules principaux (explication simple)
- **Contribuables**: creation, edition, statut, fiches, photos.
- **Taxes & categories**: definition des taxes, categories et montants.
- **Avis d'imposition**: generation et suivi par contribuable.
- **Generation groupee d'avis**: filtres par categorie/commune/quartier, prise en compte du debut d'exercice, export ZIP.
- **Paiements internes**: encaissement manuel par le personnel.
- **Collecteurs & API**: integration des banques / plateformes externes.
- **Rapports**: exports, etats, historiques.
- **Journal API**: trace des appels API collecteurs.

---

## 5) Roles & acces
Roles disponibles: `SUPER_ADMIN`, `ADMIN`, `AGENT`, `CAISSIER`, `AUDITEUR`.
L'acces est controle par:
- Le role
- La commune (si applicable)
- Les modules actifs pour l'utilisateur

---

## 6) Workflow global (metier)
**Schema simple**
1) **Configuration initiale**
   - Creer les communes
   - Definir les categories de contribuables
   - Definir les taxes et regles
2) **Gestion des contribuables**
   - Ajouter un contribuable (profil, categorie, commune, etc.)
3) **Generation d'avis**
   - Generer un avis d'imposition (numero d'avis unique)
4) **Encaissement**
   - Interne: encaissement manuel dans l'interface
   - Collecteurs: encaissement via API externe
5) **Suivi & controle**
   - Consulter l'historique des paiements
   - Exporter les rapports
   - Verifier les logs API

---

## 7) Parcours utilisateur interne (tutoriel rapide)
1) **Lancer la plateforme**
   - Installer et demarrer (voir section 10)
2) **Configurer la base**
   - Ajouter une commune
   - Ajouter des categories de contribuables
   - Ajouter des taxes actives
3) **Creer un contribuable**
   - Saisir les infos principales (nom, telephone, commune, categorie)
   - Enregistrer et verifier la fiche
4) **Generer un avis**
   - Generer l'avis d'imposition
   - Recuperer le `noticeNumber`
5) **Encaisser (interne)**
   - Utiliser la page paiements pour enregistrer un encaissement
6) **Suivre**
   - Consulter l'historique des paiements
   - Verifier le Journal API

---

## 8) Parcours collecteur externe (API)
1) **Login**
   - Le collecteur obtient un JWT via `/api/collector/login`.
2) **Verifier un avis (optionnel)**
   - `/api/collector/tax-details` avec `noticeNumber` + `taxpayerCode`.
3) **Encaisser**
   - `/api/collector/payments` avec `noticeNumber`, `taxpayerCode`, `AmountCollected`, `ReferenceID`, `DateofPayment`.
4) **Recuperer les paiements**
   - `GET /api/collector/payments?noticeNumber=...`

Guide complet: `docs/README-PARTNERS.md`

---

## 9) Donnees et formats importants
- **Numero d'avis**: `T2-26-00001`
- **Code contribuable**: `01-C2-00001`
- **ReferenceID**: identifiant unique du paiement (idempotence)
- **DateofPayment**: timestamp epoch en millisecondes

---

## 10) Demarrage local (pour demo)
```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```
Ouvrir: `http://localhost:3000`

---

## 11) Journal API et audit
Toutes les actions API collecteurs sont loggees (succes + erreurs). Ces logs permettent de:
- Tracer chaque appel
- Verifier l'idempotence
- Auditer les paiements

---

## 12) Bonnes pratiques (a rappeler en formation)
- Utiliser un `ReferenceID` unique par paiement collecteur.
- Verifier `noticeNumber` + `taxpayerCode` avant encaissement.
- Garder les identifiants collecteurs en lieu sur.
- Configurer SMTP pour l'envoi d'acces collecteur.

---

## 13) Documentation complementaire
- Guide partenaires: `docs/README-PARTNERS.md`
- API collecteurs (detail technique): `docs/payment-api.md`
