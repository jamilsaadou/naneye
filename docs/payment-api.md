# API Paiement Collecteurs

## Vue d'ensemble
Cette API permet aux collecteurs externes (banques / plateformes) d'enregistrer un paiement pour une facture fiscale.
Les collecteurs se connectent d'abord via **/api/collector/login** pour obtenir un JWT (HS256).

Toutes les requetes sont securisees par JWT et necessitent un collecteur **ACTIF**.

## Workflow (resume)
1) Se connecter via `/api/collector/login` pour obtenir un JWT.
2) (Optionnel) Recuperer les details de l'avis via `/api/collector/tax-details`.
3) Enregistrer le paiement via `/api/collector/payments`.
4) Recuperer un paiement via `GET /api/collector/payments?noticeNumber=...`.

## 1) Connexion (JWT)

`POST /api/collector/login`

### Body JSON
```json
{
  "email": "collecteur@banque.tld",
  "password": "<mot-de-passe>"
}
```

- `email` ou `code` (string, obligatoire): identifiant du collecteur.
- `password` (string, obligatoire): mot de passe du collecteur (champ `jwtSecret`).

### Reponse (succes)
```json
{
  "ok": true,
  "token": "<jwt>",
  "expiresIn": 300,
  "collector": {
    "id": "uuid",
    "code": "COL-001",
    "name": "Collecteur Banque X",
    "email": "collecteur@banque.tld",
    "phone": "+227..."
  }
}
```

### Codes & messages
- 200 `ok: true` → login reussi
- 400 `ok: false`, `message: "Données invalides"`
- 401 `ok: false`, `message: "Identifiants invalides"`

Exemple erreur:
```json
{ "ok": false, "message": "Identifiants invalides" }
```

## 2) Details d'avis (tax details)

`POST /api/collector/tax-details`

### Headers
- `Authorization: Bearer <jwt>`
- `Content-Type: application/json`

### Body JSON
```json
{
  "noticeNumber": "T1-26-00001",
  "taxpayerCode": "TP-001"
}
```

### Reponse (exemple)
```json
{
  "ok": true,
  "taxpayer": {
    "code": "TP-001",
    "name": "Entreprise X",
    "category": "Commerce",
    "phone": "+227...",
    "email": "contact@exemple.tld",
    "address": "...",
    "commune": "...",
    "neighborhood": "..."
  },
  "notice": {
    "number": "T1-26-00001",
    "year": 2026,
    "periodStart": "2026-01-01T00:00:00.000Z",
    "periodEnd": "2026-12-31T23:59:59.000Z",
    "status": "UNPAID",
    "totalAmount": 15000,
    "amountPaid": 0
  }
}
```

### Codes & messages
- 200 `ok: true` → details retournes
- 400 `ok: false`, `message: "Données invalides"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "Identifiants invalides"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

Exemple erreur:
```json
{ "ok": false, "message": "Avis introuvable" }
```

## 3) Enregistrer un paiement

`POST /api/collector/payments`

### Headers
- `Authorization: Bearer <jwt>`
- `Content-Type: application/json`

### Body JSON
```json
{
  "noticeNumber": "T1-26-00001",
  "taxpayerCode": "01-C1-00001",
  "AmountCollected": 15000,
  "ReferenceID": "REF-00001",
  "DateofPayment": 1733898391000
}
```

- `noticeNumber` (string, obligatoire): numero d'avis d'imposition (ex: `T2-26-00001`).
- `taxpayerCode` (string, obligatoire): code contribuable (ex: `01-C2-00001`).
- `AmountCollected` (number, obligatoire): montant encaisse.
- `ReferenceID` (string, obligatoire): identifiant unique du paiement (systeme collecteur).
- `DateofPayment` (number, obligatoire): timestamp epoch en millisecondes (date de paiement).
- La methode de paiement est renseignee automatiquement avec le nom du collecteur.

### Codes & messages
- 200 `ok: true` → paiement enregistre
- 200 `ok: true`, `message: "Paiement deja enregistre"` → idempotent (`ReferenceID` existe deja)
- 400 `ok: false`, `message: "Donnees invalides"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "Contribuable non conforme"`
- 400 `ok: false`, `message: "DateofPayment invalide"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

Exemple erreur:
```json
{ "ok": false, "message": "Contribuable non conforme" }
```

## 4) Recuperer un paiement

`GET /api/collector/payments?noticeNumber=T2-26-00001`

### Headers
- `Authorization: Bearer <jwt>`

### Reponse (exemple)
```json
{
  "ok": true,
  "notice": {
    "status": "PAID",
    "totalAmount": 15000,
    "amountPaid": 15000,
    "noticeNumber": "T2-26-00001"
  },
  "taxpayer": {
    "id": "uuid",
    "code": "TP-001",
    "name": "Entreprise X",
    "phone": "+227...",
    "email": "contact@exemple.tld",
    "commune": "...",
    "neighborhood": "..."
  },
  "payments": [
    {
      "id": "uuid",
      "referenceId": "REF-00001",
      "amount": 15000,
      "paidAt": "2026-01-29T10:15:00.000Z"
    }
  ]
}
```

### Codes & messages
- 200 `ok: true` → paiement(s) retournes
- 400 `ok: false`, `message: "noticeNumber manquant"`
- 400 `ok: false`, `message: "Avis introuvable"`
- 400 `ok: false`, `message: "JWT manquant"` (ou JWT invalide/expire)

Exemple erreur:
```json
{ "ok": false, "message": "noticeNumber manquant" }
```

## JWT (HS256)

### Claims obligatoires

- `iss`: code du collecteur (ex: `COL-001`)
- `exp`: expiration (timestamp seconds)

### Exemple payload

```json
{
  "iss": "COL-001",
  "exp": 1767225600
}
```

## Reponses

### Succes

```json
{
  "ok": true,
  "paymentId": "uuid"
}
```

### Doublon (idempotent)

```json
{
  "ok": true,
  "message": "Paiement deja enregistre"
}
```

### Erreur

```json
{
  "ok": false,
  "message": "..."
}
```

## Logs API

Les appels sont traces dans le **Journal API** :
- date/heure
- collecteur
- txnId (requete et JWT)
- statut (`SUCCESS`, `FAILED`, `IGNORED`)
- message

## Parametrage collecteur

Chaque collecteur doit avoir :
- `code` (utilise comme `iss`)
- `jwtSecret` (mot de passe)
- `status` = ACTIVE

Ces champs sont configurables dans la page **Collecteurs**.

## Notes de securite

- Les tokens JWT sont lies a une transaction (`txnId`).
- Toute reutilisation d'un token pour un autre `txnId` est rejetee.
- Le `txnId` doit etre unique (stocke dans `Payment.externalTxnId`).

## Encaissement interne (/payments)

Dans l'interface `/payments`, la date de paiement n'est pas saisissable non plus : elle est horodatee automatiquement par le serveur (timestamp).
Si le mode est `TRANSFER` ou `CHEQUE`, il faut joindre une photo de la preuve de paiement.
