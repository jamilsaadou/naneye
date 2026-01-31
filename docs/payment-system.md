# Gestion des paiements - Architecture simple (recommandee)

Ce document decrit une integration de paiement simple, propre et compatible avec la logique actuelle :
- L'UI reste dans Next.js.
- La banque ne connait qu'un webhook technique.
- Les secrets restent uniquement cote serveur.

## Principe general
Ne cree pas une passerelle hebergee ailleurs. Conserve tout dans le backend (meme domaine/serveur).
Expose un **seul endpoint public** (webhook) et garde tout le reste prive.

## Flux recommande
### 1) Frontend (Next.js)
- L'utilisateur clique "Payer".
- Le front appelle **/api/payments/initiate**.
- Le backend renvoie un `paymentIntentId` et, si necessaire, un `redirectUrl`.

### 2) Backend (service paiement)
Centralise l'integration banque dans un module clairement separe, meme si c'est encore dans des API routes.

**POST /api/payments/initiate**
- Cree un intent (reference interne),
- Appelle l'API de la banque,
- Enregistre la transaction.

**POST /api/webhooks/bank-x** (public)
- Recoit le statut (paid/failed),
- Verifie la signature,
- Met a jour la base.

La banque ne voit jamais l'UI. Elle n'appelle qu'une URL technique de webhook.

## Regles essentielles (sans complexite)
1) **Secrets uniquement cote serveur**
   - Jamais de cle API dans le front.
   - Toutes les cles dans les variables d'environnement.

2) **Webhook securise**
   - Verifier la signature (HMAC) ou un token secret dans un header.
   - Refuser les requetes non signees.

3) **Idempotence**
   - Une meme notification ne doit pas encaisser deux fois.
   - Utiliser un champ de reference unique (ex: `externalTxnId`).

4) **References opaques**
   - Envoyer a la banque une reference interne type `TXN-UUID`.
   - Ne jamais exposer `avisId=123`.

## Endpoints proposes
### POST /api/payments/initiate (prive)
**Body (exemple):**
```json
{
  "noticeNumber": "T1-26-00001",
  "amount": 15000,
  "method": "bank-x"
}
```

**Reponse (exemple):**
```json
{
  "ok": true,
  "paymentIntentId": "TXN-20260127-0001",
  "redirectUrl": "https://bank.example.com/pay/...."
}
```

### POST /api/webhooks/bank-x (public)
**Headers**
- `X-Signature: <hmac>` (ou autre schema fourni par la banque)

**Body (exemple):**
```json
{
  "reference": "TXN-20260127-0001",
  "status": "paid",
  "amount": 15000
}
```

**Reponse (exemple):**
```json
{ "ok": true }
```

## Recommandations de mise en oeuvre
- Stocker les statuts: `PENDING`, `PAID`, `FAILED`.
- Historiser toutes les notifications webhook.
- Garder un log technique pour audit.
- Utiliser des timeouts et retries cote banque.

## Checklist configuration
- [ ] Definir les variables d'environnement (cle API + secret webhook)
- [ ] Creer la table `PaymentIntent` ou equivalent
- [ ] Bloquer les double notifications (idempotence)
- [ ] Tester le webhook en environnement de test

