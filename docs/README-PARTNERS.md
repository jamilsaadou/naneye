# API Collecteurs - Guide Partenaires

Ce document fournit un guide clair pour integrer les API collecteurs.

## Base URL
- Production: `https://<votre-domaine>`
- Local: `http://localhost:3000`

## Format des identifiants
- `noticeNumber` (numero d'avis): `T2-26-00001`
- `taxpayerCode` (code contribuable): `01-C2-00001`

## Authentification

### 1) Login (recuperer un JWT)
**POST** `/api/collector/login`

**Headers**
- `Content-Type: application/json`

**Body**
```json
{
  "email": "collecteur@banque.tld",
  "password": "<mot-de-passe>"
}
```

**Reponse (succes)**
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

**Erreurs possibles**
```json
{ "ok": false, "message": "Données invalides" }
{ "ok": false, "message": "Identifiants invalides" }
```

**cURL**
```bash
curl -X POST "http://localhost:3000/api/collector/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "collecteur@banque.tld",
    "password": "<mot-de-passe>"
  }'
```

> Le JWT doit etre envoye dans l'en-tete `Authorization: Bearer <jwt>` pour tous les appels suivants.

---

## 2) Details d'avis (tax details)
**POST** `/api/collector/tax-details`

**Headers**
- `Authorization: Bearer <jwt>`
- `Content-Type: application/json`

**Body**
```json
{
  "noticeNumber": "T2-26-00001",
  "taxpayerCode": "01-C2-00001"
}
```

**Reponse (exemple)**
```json
{
  "ok": true,
  "taxpayer": {
    "code": "01-C2-00001",
    "name": "Station Sandire",
    "category": "Station",
    "phone": "0000000",
    "email": null,
    "address": "Banifandou",
    "commune": "Commune 2",
    "neighborhood": "Boukoki 1"
  },
  "notice": {
    "number": "T2-26-00001",
    "year": 2026,
    "periodStart": "2025-12-31T23:00:00.000Z",
    "periodEnd": "2026-12-30T23:00:00.000Z",
    "status": "PARTIAL",
    "totalAmount": 440000,
    "amountPaid": 10500
  }
}
```

**Erreurs possibles**
```json
{ "ok": false, "message": "Données invalides" }
{ "ok": false, "message": "Avis introuvable" }
{ "ok": false, "message": "Identifiants invalides" }
{ "ok": false, "message": "JWT manquant" }
```

**cURL**
```bash
curl -X POST "http://localhost:3000/api/collector/tax-details" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "noticeNumber": "T2-26-00001",
    "taxpayerCode": "01-C2-00001"
  }'
```

---

## 3) Enregistrer un paiement
**POST** `/api/collector/payments`

**Headers**
- `Authorization: Bearer <jwt>`
- `Content-Type: application/json`

**Body**
```json
{
  "noticeNumber": "T2-26-00001",
  "taxpayerCode": "01-C2-00001",
  "AmountCollected": 10000,
  "ReferenceID": "1",
  "DateofPayment": 1733898391000
}
```

**Regles**
- `ReferenceID` est unique pour l'idempotence.
- `DateofPayment` est un timestamp epoch en millisecondes.
- La methode de paiement est renseignee automatiquement avec le nom du collecteur.

**Reponse (succes)**
```json
{ "ok": true, "paymentId": "uuid" }
```

**Reponse (doublon ReferenceID)**
```json
{ "ok": true, "message": "Paiement deja enregistre" }
```

**Erreurs possibles**
```json
{ "ok": false, "message": "Donnees invalides" }
{ "ok": false, "message": "Avis introuvable" }
{ "ok": false, "message": "Contribuable non conforme" }
{ "ok": false, "message": "DateofPayment invalide" }
{ "ok": false, "message": "JWT manquant" }
```

**cURL**
```bash
curl -X POST "http://localhost:3000/api/collector/payments" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "noticeNumber": "T2-26-00001",
    "taxpayerCode": "01-C2-00001",
    "AmountCollected": 10000,
    "ReferenceID": "1",
    "DateofPayment": 1733898391000
  }'
```

---

## 4) Recuperer les paiements d'un avis
**GET** `/api/collector/payments?noticeNumber=T2-26-00001`

**Headers**
- `Authorization: Bearer <jwt>`

**Reponse (exemple)**
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
    "code": "01-C2-00001",
    "name": "Entreprise X",
    "phone": "+227...",
    "email": "contact@exemple.tld",
    "commune": "...",
    "neighborhood": "..."
  },
  "payments": [
    {
      "id": "uuid",
      "referenceId": "1",
      "amount": 15000,
      "paidAt": "2026-01-29T10:15:00.000Z"
    }
  ]
}
```

**Erreurs possibles**
```json
{ "ok": false, "message": "noticeNumber manquant" }
{ "ok": false, "message": "Avis introuvable" }
{ "ok": false, "message": "JWT manquant" }
```

**cURL**
```bash
curl -X GET "http://localhost:3000/api/collector/payments?noticeNumber=T2-26-00001" \
  -H "Authorization: Bearer <JWT>"
```

---

## Notes de securite
- Le collecteur doit etre **ACTIF** pour utiliser l'API.
- Tous les appels necessitent un JWT valide.
