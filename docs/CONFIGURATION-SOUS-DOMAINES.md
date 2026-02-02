# 🌐 Configuration avec Sous-Domaines Séparés

Guide complet pour configurer l'application avec deux sous-domaines distincts:
- **Frontend**: `app.votre-domaine.com`
- **API**: `api.votre-domaine.com`

## 📋 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Serveur (123.45.67.89)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────┐    ┌────────────────────────┐   │
│  │   app.votre-domaine    │    │   api.votre-domaine    │   │
│  │    (Port 443 HTTPS)    │    │    (Port 443 HTTPS)    │   │
│  └──────────┬─────────────┘    └──────────┬─────────────┘   │
│             │                               │                 │
│             ├───────────────┬───────────────┤                 │
│             │               │               │                 │
│         ┌───▼───────────────▼───────────────▼───┐             │
│         │           Nginx (Reverse Proxy)       │             │
│         └───┬───────────────────────────────┬───┘             │
│             │                               │                 │
│             ▼                               ▼                 │
│      ┌─────────────┐                 ┌─────────────┐         │
│      │  Frontend   │◄────────────────┤  API Routes │         │
│      │ (Pages SSR) │                 │ (/api/*)    │         │
│      └─────────────┘                 └─────────────┘         │
│             │                               │                 │
│             └───────────┬───────────────────┘                 │
│                         ▼                                     │
│                  Next.js (localhost:3000)                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## ✅ Avantages de cette architecture

1. **Séparation des préoccupations** - Frontend et API clairement séparés
2. **Évolutivité** - Possibilité de déplacer l'API sur un serveur séparé plus tard
3. **Sécurité** - Isolation des endpoints API
4. **CDN/Cache** - Possibilité de cacher différemment frontend et API
5. **Multi-plateforme** - Même API utilisable par mobile/desktop

## ⚠️ Important à savoir

- Les deux sous-domaines **pointent vers la même adresse IP** (votre serveur)
- **Nginx** se charge de router vers le bon service selon le sous-domaine
- Nécessite la configuration **CORS** car frontend et API sont sur des domaines différents
- Nécessite **deux certificats SSL** (ou un certificat wildcard)

---

## 📍 Étape 1: Configuration DNS

### Pointer les deux sous-domaines vers le même serveur

Chez votre registrar (OVH, Namecheap, etc.), créez ces enregistrements DNS:

```
Type: A
Nom: app
Valeur: 123.45.67.89 (IP de votre serveur)
TTL: 3600

Type: A
Nom: api
Valeur: 123.45.67.89 (même IP)
TTL: 3600
```

**Note:** Les deux sous-domaines pointent vers la **même adresse IP**.

### Vérification DNS

Attendez quelques minutes (jusqu'à 48h pour propagation complète), puis testez:

```bash
# Vérifier app.votre-domaine.com
nslookup app.votre-domaine.com
# Devrait retourner: 123.45.67.89

# Vérifier api.votre-domaine.com
nslookup api.votre-domaine.com
# Devrait retourner: 123.45.67.89 (même IP)

# Avec dig (plus détaillé)
dig app.votre-domaine.com
dig api.votre-domaine.com
```

**Résultat attendu:** Les deux sous-domaines résolvent vers la même IP.

---

## 🔒 Étape 2: Certificats SSL

### Option A: Deux certificats séparés (RECOMMANDÉ pour débuter)

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir certificat pour app.votre-domaine.com
sudo certbot certonly --nginx -d app.votre-domaine.com

# Obtenir certificat pour api.votre-domaine.com
sudo certbot certonly --nginx -d api.votre-domaine.com
```

**Certificats créés:**
- `/etc/letsencrypt/live/app.votre-domaine.com/`
- `/etc/letsencrypt/live/api.votre-domaine.com/`

### Option B: Certificat wildcard (AVANCÉ)

Un seul certificat pour `*.votre-domaine.com`:

```bash
sudo certbot certonly --manual --preferred-challenges dns -d "*.votre-domaine.com"
```

**Note:** Nécessite de créer un enregistrement DNS TXT (Let's Encrypt vous guidera).

---

## ⚙️ Étape 3: Configuration Nginx

Créez `/etc/nginx/sites-available/taxes-app-subdomains`:

```nginx
# ═══════════════════════════════════════════════════════════════
# Redirection HTTP → HTTPS (app)
# ═══════════════════════════════════════════════════════════════
server {
    listen 80;
    listen [::]:80;
    server_name app.votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

# ═══════════════════════════════════════════════════════════════
# Redirection HTTP → HTTPS (api)
# ═══════════════════════════════════════════════════════════════
server {
    listen 80;
    listen [::]:80;
    server_name api.votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

# ═══════════════════════════════════════════════════════════════
# Frontend - app.votre-domaine.com
# ═══════════════════════════════════════════════════════════════
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name app.votre-domaine.com;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/app.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.votre-domaine.com/privkey.pem;

    # Paramètres SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Fichiers uploadés
    location /uploads/ {
        alias /home/taxapp/app/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Fichiers statiques Next.js
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Pages frontend (tout sauf /api)
    location / {
        # Bloquer l'accès direct aux routes /api/* depuis le frontend
        location ~ ^/api/ {
            return 404;
        }

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Logs
    access_log /var/log/nginx/app_access.log;
    error_log /var/log/nginx/app_error.log warn;

    client_max_body_size 10M;
}

# ═══════════════════════════════════════════════════════════════
# API - api.votre-domaine.com
# ═══════════════════════════════════════════════════════════════
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.votre-domaine.com;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/api.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.votre-domaine.com/privkey.pem;

    # Paramètres SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;

    # ⭐ Headers CORS (CRUCIAL pour sous-domaines séparés)
    add_header Access-Control-Allow-Origin "https://app.votre-domaine.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type, x-csrf-token, Authorization" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Répondre aux requêtes OPTIONS (preflight CORS)
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "https://app.votre-domaine.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, x-csrf-token, Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
        add_header Content-Length 0;
        return 204;
    }

    # Routes API uniquement
    location / {
        # Réécrire pour ajouter /api si pas présent
        rewrite ^/(.*)$ /api/$1 break;

        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host app.votre-domaine.com;  # Important: utiliser le host principal
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Logs
    access_log /var/log/nginx/api_access.log;
    error_log /var/log/nginx/api_error.log warn;

    client_max_body_size 10M;
}
```

### Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/taxes-app-subdomains /etc/nginx/sites-enabled/

# Supprimer l'ancienne config si elle existe
sudo rm /etc/nginx/sites-enabled/taxes-app

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

---

## 🔧 Étape 4: Configuration de l'Application

### Modifier le fichier .env

```bash
# .env (sur le serveur)
NODE_ENV="production"
DATABASE_URL="postgresql://taxapp:password@localhost:5432/gestion_taxes"
SESSION_SECRET="votre-secret-tres-long-et-aleatoire"

# ⭐ URLs avec sous-domaines séparés
NEXT_PUBLIC_APP_URL="https://app.votre-domaine.com"
NEXT_PUBLIC_API_BASE_URL="https://api.votre-domaine.com"

# Admin
ADMIN_EMAIL="admin@votre-domaine.com"
ADMIN_PASSWORD="mot-de-passe-securise"

# ⭐ CORS: Domaines autorisés (séparés par des virgules)
ALLOWED_ORIGINS="https://app.votre-domaine.com"
```

### Configurer CORS dans Next.js

Modifiez `middleware.ts` pour ajouter les headers CORS:

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  CSRF_COOKIE_NAME,
  generateCsrfToken,
  getCsrfCookieOptions,
} from "@/lib/csrf-core";
import {
  createSessionToken,
  getSessionCookieOptions,
  readSessionToken,
  SESSION_COOKIE_NAME,
  shouldRotateSession,
} from "@/lib/session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((path) => pathname === path)) return true;
  if (pathname.startsWith("/api/collector")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

// ⭐ Fonction pour gérer CORS avec sous-domaines séparés
function handleCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin");
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [];

  // Vérifier si l'origine est autorisée
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-csrf-token, Authorization");
  }

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ⭐ Gérer les requêtes OPTIONS (preflight CORS)
  if (request.method === "OPTIONS") {
    const response = new NextResponse(null, { status: 204 });
    return handleCors(request, response);
  }

  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await readSessionToken(sessionToken);
  const sessionOk = Boolean(session);
  const csrfToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;

  let response: NextResponse;
  if (isPublicPath(pathname)) {
    if (pathname === "/login" && sessionOk) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      response = NextResponse.redirect(url);
    } else {
      response = NextResponse.next();
    }
  } else if (!sessionOk) {
    if (pathname.startsWith("/api")) {
      response = NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    } else {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      response = NextResponse.redirect(url);
    }
  } else {
    response = NextResponse.next();
  }

  // ⭐ Ajouter les headers CORS à toutes les réponses API
  if (pathname.startsWith("/api")) {
    response = handleCors(request, response);
  }

  if (!csrfToken) {
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: generateCsrfToken(),
      ...getCsrfCookieOptions(request.headers),
    });
  }

  if (sessionToken && !session) {
    response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", path: "/", maxAge: 0 });
  }

  if (session && shouldRotateSession(session)) {
    const refreshed = await createSessionToken({ id: session.id, role: session.role });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: refreshed,
      ...getSessionCookieOptions(),
    });
  }

  response.headers.set("x-pathname", pathname);
  return response;
}

export const config = {
  matcher: "/:path*",
};
```

### Configurer les cookies pour cross-domain

Modifiez `lib/session.ts` pour permettre les cookies cross-domain:

```typescript
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "none" as const, // ⭐ Changé de "lax" à "none" pour cross-domain
    secure: true, // ⭐ Obligatoire avec sameSite: "none"
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}
```

Modifiez `lib/csrf-core.ts`:

```typescript
export function getCsrfCookieOptions(headers?: Headers) {
  return {
    httpOnly: false,
    sameSite: "none" as const, // ⭐ Changé de "lax" à "none" pour cross-domain
    path: "/",
    secure: isSecureContext(headers), // Déjà configuré pour détection dynamique
    maxAge: CSRF_TTL_SECONDS,
  };
}
```

---

## 🔄 Étape 5: Rebuild et Redémarrage

Après avoir modifié la configuration:

```bash
# Se connecter au serveur
ssh user@123.45.67.89

# Aller dans le dossier de l'application
cd /home/taxapp/app

# Mettre à jour .env avec les nouvelles URLs
nano .env

# Rebuild l'application
npm run build

# Redémarrer PM2
pm2 restart taxes-app

# Vérifier les logs
pm2 logs taxes-app
```

---

## 🧪 Étape 6: Tests

### Test 1: Vérifier les DNS

```bash
# Tester app.votre-domaine.com
curl -I https://app.votre-domaine.com
# Devrait retourner 200 OK

# Tester api.votre-domaine.com
curl -I https://api.votre-domaine.com/auth/me
# Devrait retourner 401 Unauthorized (normal sans auth)
```

### Test 2: Vérifier les certificats SSL

```bash
# Vérifier le certificat app
openssl s_client -connect app.votre-domaine.com:443 -servername app.votre-domaine.com </dev/null

# Vérifier le certificat api
openssl s_client -connect api.votre-domaine.com:443 -servername api.votre-domaine.com </dev/null
```

### Test 3: Vérifier CORS

```bash
# Test de requête OPTIONS (preflight)
curl -X OPTIONS https://api.votre-domaine.com/auth/me \
  -H "Origin: https://app.votre-domaine.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-csrf-token" \
  -v

# Devrait retourner les headers CORS:
# Access-Control-Allow-Origin: https://app.votre-domaine.com
# Access-Control-Allow-Credentials: true
```

### Test 4: Test complet de connexion

Dans la console du navigateur sur `https://app.votre-domaine.com`:

```javascript
// Récupérer le token CSRF
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1];

console.log('CSRF Token:', csrfToken);

// Tester la connexion
fetch('https://api.votre-domaine.com/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  credentials: 'include', // Important pour envoyer les cookies
  body: JSON.stringify({
    email: 'admin@votre-domaine.com',
    password: 'votre-mot-de-passe'
  })
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
```

---

## 📊 Schéma des flux de communication

### Connexion utilisateur

```
┌──────────┐                                    ┌──────────┐
│ Browser  │                                    │  Server  │
└────┬─────┘                                    └────┬─────┘
     │                                                │
     │  1. GET https://app.votre-domaine.com         │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  2. HTML + CSRF Cookie                         │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  3. POST https://api.votre-domaine.com/auth/login
     │     Headers: x-csrf-token, Origin              │
     │     Body: {email, password}                    │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  4. (Preflight) OPTIONS                        │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  5. 204 + CORS Headers                         │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  6. (Real Request) POST                        │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  7. 200 OK + Session Cookie + CORS Headers     │
     │<──────────────────────────────────────────────┤
     │                                                │
     │  8. GET https://api.votre-domaine.com/taxpayers
     │     Cookie: session_token                      │
     │     Headers: x-csrf-token                      │
     ├──────────────────────────────────────────────>│
     │                                                │
     │  9. 200 OK + Data + CORS Headers               │
     │<──────────────────────────────────────────────┤
     │                                                │
```

---

## ⚠️ Problèmes courants et solutions

### Problème 1: "CORS policy: No 'Access-Control-Allow-Origin' header"

**Cause:** Headers CORS non configurés correctement

**Solution:**
1. Vérifier que `ALLOWED_ORIGINS` dans `.env` contient `https://app.votre-domaine.com`
2. Vérifier que le middleware ajoute les headers CORS
3. Recharger Nginx: `sudo systemctl reload nginx`

### Problème 2: Cookies non envoyés entre domaines

**Cause:** `sameSite` doit être `none` avec `secure: true`

**Solution:**
1. Vérifier que `sameSite: "none"` dans `session.ts` et `csrf-core.ts`
2. Vérifier que `secure: true` (obligatoire avec `sameSite: none`)
3. S'assurer d'utiliser HTTPS (pas HTTP)

### Problème 3: "Token CSRF manquant"

**Cause:** Cookie CSRF pas lu correctement cross-domain

**Solution:**
1. Vérifier que `credentials: 'include'` dans les requêtes fetch
2. Vérifier que `Access-Control-Allow-Credentials: true` dans les headers
3. Utiliser le script de diagnostic:

```bash
./check-csrf.sh https://api.votre-domaine.com
```

### Problème 4: Certificat SSL invalide

**Cause:** Certificat non valide pour le sous-domaine

**Solution:**
```bash
# Vérifier les certificats
sudo certbot certificates

# Renouveler si nécessaire
sudo certbot renew
```

---

## 🔐 Sécurité avancée

### 1. Limitation de débit (Rate Limiting)

Ajoutez dans Nginx (section `api.votre-domaine.com`):

```nginx
# Avant le bloc server
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

# Dans le bloc server API
location / {
    limit_req zone=api_limit burst=20 nodelay;
    # ... reste de la config
}
```

### 2. Bloquer l'accès direct à l'API depuis le navigateur

Si vous voulez que l'API soit accessible UNIQUEMENT depuis le frontend:

```nginx
# Dans le bloc server API
# Bloquer si pas de header Origin ou Referer valide
set $valid_origin 0;
if ($http_origin ~* "^https://app\.votre-domaine\.com$") {
    set $valid_origin 1;
}
if ($http_referer ~* "^https://app\.votre-domaine\.com") {
    set $valid_origin 1;
}
if ($valid_origin = 0) {
    return 403;
}
```

### 3. Logs séparés pour monitoring

Nginx crée automatiquement des logs séparés:
- `/var/log/nginx/app_access.log` - Logs du frontend
- `/var/log/nginx/api_access.log` - Logs de l'API

Analysez les logs:
```bash
# Requêtes les plus fréquentes sur l'API
sudo tail -f /var/log/nginx/api_access.log | grep -v "/_next"

# Erreurs CORS
sudo grep "CORS" /var/log/nginx/api_error.log
```

---

## 📚 Checklist de déploiement

### Configuration DNS
- [ ] Enregistrement A pour `app.votre-domaine.com` → IP serveur
- [ ] Enregistrement A pour `api.votre-domaine.com` → IP serveur
- [ ] DNS propagé et résolvant correctement

### Certificats SSL
- [ ] Certificat SSL pour `app.votre-domaine.com`
- [ ] Certificat SSL pour `api.votre-domaine.com`
- [ ] Renouvellement automatique Certbot configuré

### Configuration Nginx
- [ ] Configuration des deux sous-domaines créée
- [ ] Redirection HTTP → HTTPS active
- [ ] Headers CORS configurés sur le bloc API
- [ ] Logs séparés pour app et api
- [ ] Configuration testée: `sudo nginx -t`
- [ ] Nginx rechargé: `sudo systemctl reload nginx`

### Configuration application
- [ ] `.env` mis à jour avec `NEXT_PUBLIC_APP_URL` et `NEXT_PUBLIC_API_BASE_URL`
- [ ] `ALLOWED_ORIGINS` défini avec le domaine frontend
- [ ] Middleware modifié pour CORS
- [ ] `sameSite: "none"` dans session.ts et csrf-core.ts
- [ ] Application rebuild: `npm run build`
- [ ] PM2 redémarré: `pm2 restart taxes-app`

### Tests
- [ ] Frontend accessible sur `https://app.votre-domaine.com`
- [ ] API accessible sur `https://api.votre-domaine.com`
- [ ] Certificats SSL valides (pas d'erreur dans le navigateur)
- [ ] CORS fonctionnel (pas d'erreur dans la console)
- [ ] Connexion fonctionnelle depuis le frontend
- [ ] Cookies cross-domain fonctionnels

---

## 🎯 Résumé

**Architecture finale:**

```
DNS:
  app.votre-domaine.com  →  123.45.67.89
  api.votre-domaine.com  →  123.45.67.89 (même IP)

Nginx (sur 123.45.67.89):
  app.votre-domaine.com:443  →  localhost:3000 (pages)
  api.votre-domaine.com:443  →  localhost:3000/api/* (API)

Next.js (localhost:3000):
  - Pages frontend (SSR)
  - Routes API (/api/*)
  - Même processus, routage par Nginx
```

**Points clés:**
1. ✅ Les deux sous-domaines pointent vers la **même IP**
2. ✅ **Nginx** route selon le sous-domaine
3. ✅ **CORS** obligatoire car domaines différents
4. ✅ `sameSite: "none"` obligatoire pour cookies cross-domain
5. ✅ **Deux certificats SSL** (ou un wildcard)

**Avantages:**
- Séparation claire frontend/API
- Évolutivité (facile de séparer sur 2 serveurs plus tard)
- Sécurité (isolation des endpoints)

**Maintenance:**
- Certificats SSL: renouvellement automatique
- Pas besoin de rebuild pour changer de config Nginx
- Logs séparés facilitent le debugging

<function_calls>
<invoke name="Read">
<parameter name="file_path">/Users/air/Documents/Dev project/Gestion des taxes/middleware.ts