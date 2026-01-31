# API Collecteurs

Ce document decrit la connexion (generation du JWT) et l'envoi des paiements par les collecteurs.

## Demarrage local

### Prerequis
- Node.js 18+ (recommande)
- Postgres en local

### Etapes
1) Installer les dependances:
```bash
npm install
```

2) Configurer la base de donnees dans `.env`:
```bash
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db>?schema=public"
```

3) Generer le client Prisma et lancer les migrations:
```bash
npm run prisma:generate
npm run prisma:migrate
```

4) (Optionnel) Charger des donnees de demo:
```bash
npm run prisma:seed
```

5) Lancer le serveur:
```bash
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## 1) Connexion (generation du JWT via API)

**Endpoint**: `POST /api/collector/login`

### Body
```json
{
  "email": "collecteur@banque.tld",
  "password": "<mot-de-passe>"
}
```

### Reponse (succes)
```json
{
  "ok": true,
  "token": "<jwt>",
  "expiresIn": 300,
  "collector": {
    "id": "<uuid>",
    "code": "COL-001",
    "name": "Collecteur Banque X",
    "email": "collecteur@banque.tld",
    "phone": "+227..."
  }
}
```

> Le JWT est obligatoire pour tous les appels collecteurs.

### Codes & messages
- 200 `ok: true` → login reussi
- 400 `ok: false`, `message: "Données invalides"`
- 401 `ok: false`, `message: "Identifiants invalides"`

Exemple erreur:
```json
{ "ok": false, "message": "Identifiants invalides" }
```

## 2) Details d'avis (optionnel)

**Endpoint**: `POST /api/collector/tax-details`

### Headers
- `Authorization: Bearer <JWT>`
- `Content-Type: application/json`

### Body
```json
{
  "noticeNumber": "T1-26-00001",
  "taxpayerCode": "TP-001"
}
```

### Codes & messages
- 200 `ok: true` → details retournes
- 400 `ok: false`, `message: "Données invalides"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "Identifiants invalides"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

## 3) Paiement

**Endpoint**: `POST /api/collector/payments`

### Headers
- `Authorization: Bearer <JWT>`
- `Content-Type: application/json`

### Body
```json
{
  "noticeNumber": "T1-26-00001",
  "taxpayerCode": "01-C1-00001",
  "AmountCollected": 15000,
  "ReferenceID": "REF-00001",
  "DateofPayment": 1733898391000
}
```

### Regles importantes
- Le collecteur doit etre **ACTIF**.
- `noticeNumber` doit exister.
- `taxpayerCode` doit correspondre au contribuable de l'avis.
- En cas de doublon (`ReferenceID` deja enregistre), l'API renvoie `ok: true` avec un message.
- La methode de paiement est renseignee automatiquement avec le nom du collecteur.

### Codes & messages
- 200 `ok: true` → paiement enregistre
- 200 `ok: true`, `message: "Paiement deja enregistre"` → idempotent (`ReferenceID` existe deja)
- 400 `ok: false`, `message: "Donnees invalides"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "Contribuable non conforme"`
- 400 `ok: false`, `message: "DateofPayment invalide"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

### Reponse (succes)
```json
{ "ok": true, "paymentId": "<uuid>" }
```

### Reponse (doublon)
```json
{ "ok": true, "message": "Paiement deja enregistre" }
```

### Reponse (erreur)
```json
{ "ok": false, "message": "<raison>" }
```

### Exemple cURL
```bash
curl -X POST "<API_BASE_URL>/api/collector/payments" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "noticeNumber": "T1-26-00001",
    "taxpayerCode": "01-C1-00001",
    "AmountCollected": 15000,
    "ReferenceID": "REF-00001",
    "DateofPayment": 1733898391000
  }'
```

## 4) Recuperer un paiement

**Endpoint**: `GET /api/collector/payments?noticeNumber=T2-26-00001`

### Headers
- `Authorization: Bearer <JWT>`

### Codes & messages
- 200 `ok: true` → paiement(s) retournes
- 400 `ok: false`, `message: "noticeNumber manquant"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

> Note: configure l'URL de base API dans **Paramètres > URL de base API**.

---

# Gestion des paiements - Architecture simple (recommandee)

Objectif : conserver la logique actuelle, sans passerelle externe, avec un seul webhook public.

## Principe
Ne cree pas une passerelle hebergee ailleurs. Fais un petit service paiement dans le backend (meme domaine/serveur), avec :
- un seul endpoint public (webhook),
- tout le reste prive.

## Recette simple
### 1) Next.js (UI + declenchement)
- L'utilisateur clique \"Payer\".
- Next appelle **/api/payments/initiate**.
- Le backend renvoie `paymentIntentId` + eventuel `redirectUrl`.

### 2) Backend (integration banque centralisee)
**POST /api/payments/initiate**  
→ cree un \"intent\", appelle l'API banque, enregistre la transaction.

**POST /api/webhooks/bank-x** (public)  
→ recoit le statut (paid/failed), verifie la signature, met a jour la DB.

La banque ne connait pas l'UI. Elle ne voit qu'une URL technique de webhook.

## 3 regles essentielles
1) **Secrets cote serveur uniquement** (env vars). Jamais dans le front.  
2) **Webhook securise** : verif signature (HMAC) ou token secret.  
3) **Idempotence** : une meme notif ne cree pas de double encaissement.  
4) **References opaques** : envoyer `TXN-UUID`, pas `avisId=123`.
