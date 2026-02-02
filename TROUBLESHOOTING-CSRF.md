# 🔒 Dépannage du problème "Token CSRF manquant"

## Problème: "Token CSRF manquant" en production

Ce problème survient lorsque les cookies CSRF ne peuvent pas être définis par le navigateur.

## 🔍 Diagnostic

### Vérification 1: Vérifier si le cookie CSRF est défini

Dans la console du navigateur (F12 → Console):

```javascript
console.log(document.cookie);
// Devrait contenir: csrf_token=...
```

Si le cookie n'apparaît pas, c'est le problème!

### Vérification 2: Vérifier les headers de réponse

Dans les DevTools (F12 → Network):
1. Rafraîchir la page
2. Cliquer sur la requête principale
3. Onglet "Headers" → "Response Headers"
4. Chercher: `Set-Cookie: csrf_token=...`

Si absent, le middleware ne définit pas le cookie.

## ✅ Solution 1: Configuration Nginx (RECOMMANDÉ)

Le problème classique: Nginx utilise HTTPS mais forward en HTTP vers l'application.

### Configuration Nginx correcte:

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Redirection HTTP → HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name votre-domaine.com;

    # Certificats SSL
    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    # IMPORTANT: Headers pour que Next.js sache qu'on est en HTTPS
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # ⭐ CRUCIAL: Indique que la connexion originale était en HTTPS
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_cache_bypass $http_upgrade;
    }
}
```

Puis redémarrer Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Solution 2: Mise à jour du code (si Nginx n'est pas possible)

Modifier le fichier `lib/csrf-core.ts`:

```typescript
function isProd() {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function isSecureContext(request?: Request) {
  if (typeof process === "undefined") return false;

  // Si NODE_ENV n'est pas production, pas besoin de secure
  if (process.env.NODE_ENV !== "production") return false;

  // En production, vérifier le header X-Forwarded-Proto
  // (défini par Nginx/Apache en cas de reverse proxy)
  if (request) {
    const proto = request.headers.get('x-forwarded-proto');
    return proto === 'https';
  }

  // Par défaut en production, utiliser secure
  return true;
}

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd(), // ⚠️ Ou isSecureContext() si vous voulez vérifier le header
    maxAge: CSRF_TTL_SECONDS,
  };
}
```

## ✅ Solution 3: Variable d'environnement (TEMPORAIRE)

En attendant de configurer Nginx, vous pouvez désactiver temporairement le mode production:

Dans `.env`:
```bash
# Temporaire: désactive le mode production pour les cookies
NODE_ENV=development

# Ou créer une variable spécifique:
FORCE_SECURE_COOKIES=false
```

Puis modifier `lib/csrf-core.ts`:
```typescript
function isProd() {
  // Vérifier la variable d'environnement personnalisée
  if (process.env.FORCE_SECURE_COOKIES === "false") {
    return false;
  }
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}
```

**⚠️ ATTENTION:** C'est une solution temporaire, PAS pour la production finale!

## ✅ Solution 4: Configuration Apache (alternative à Nginx)

Si vous utilisez Apache:

```apache
<VirtualHost *:443>
    ServerName votre-domaine.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/votre-domaine.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/votre-domaine.com/privkey.pem

    ProxyPreserveHost On
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # IMPORTANT: Headers pour SSL
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
</VirtualHost>
```

Puis:
```bash
sudo a2enmod headers
sudo a2enmod ssl
sudo systemctl restart apache2
```

## 🔍 Diagnostic avancé

### Test 1: Vérifier que l'application reçoit les bons headers

Créez un fichier `app/api/debug/headers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const headers: Record<string, string> = {};

  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return NextResponse.json({
    headers,
    nodeEnv: process.env.NODE_ENV,
    protocol: request.headers.get('x-forwarded-proto') || 'http',
  });
}
```

Puis visitez: `https://votre-domaine.com/api/debug/headers`

Vous devriez voir:
```json
{
  "headers": {
    "x-forwarded-proto": "https",
    ...
  },
  "nodeEnv": "production",
  "protocol": "https"
}
```

⚠️ **Supprimez cette route après le diagnostic!**

### Test 2: Tester la définition du cookie en local

```bash
# En local, démarrer l'application
npm run dev

# Dans un autre terminal
curl -I http://localhost:3000/login

# Devrait afficher:
# Set-Cookie: csrf_token=...
```

### Test 3: Tester en production

```bash
curl -I https://votre-domaine.com/login

# Devrait afficher:
# Set-Cookie: csrf_token=...; Secure; SameSite=Lax
```

Si `Set-Cookie` est absent, le middleware ne s'exécute pas.

## 📊 Checklist de vérification

- [ ] NODE_ENV=production est défini
- [ ] L'application tourne derrière HTTPS (Nginx/Apache)
- [ ] Le header `X-Forwarded-Proto: https` est transmis
- [ ] Le cookie CSRF apparaît dans les DevTools
- [ ] Nginx/Apache transmet correctement les headers
- [ ] Le middleware Next.js s'exécute bien

## 🆘 Problème persistant?

### Option A: Logs du navigateur

Console → Network → Clic sur la requête de login:
```
Request Headers:
  x-csrf-token: [doit être présent]

Response:
  401 Unauthorized
  { "message": "Token CSRF manquant" }
```

### Option B: Logs du serveur

```bash
# Si vous utilisez PM2
pm2 logs votre-app

# Logs système
journalctl -u votre-service -f
```

Cherchez des erreurs liées aux cookies ou au middleware.

## 🔐 Sécurité

**IMPORTANT:** Ne désactivez JAMAIS `secure: true` en production HTTPS!

Les cookies non sécurisés sur HTTPS sont une faille de sécurité majeure.

La bonne solution est **toujours** de configurer correctement le reverse proxy.

## 📚 Ressources

- [Next.js Behind a Proxy](https://nextjs.org/docs/app/building-your-application/deploying#behind-a-proxy)
- [Nginx SSL Configuration](https://nginx.org/en/docs/http/configuring_https_servers.html)
- [SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
