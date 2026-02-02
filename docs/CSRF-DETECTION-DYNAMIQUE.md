# 🔒 Détection Dynamique CSRF - Comment ça marche

## Principe

L'application détecte **automatiquement** si elle est en HTTPS ou HTTP en vérifiant le header `X-Forwarded-Proto` envoyé par le reverse proxy (Nginx/Apache).

## Avantages

✅ **Aucune configuration manuelle** - Fonctionne automatiquement
✅ **S'adapte à l'environnement** - HTTP en dev, HTTPS en prod
✅ **Sécurisé par défaut** - Cookies sécurisés en HTTPS
✅ **Pas de redéploiement** - Pas besoin de rebuild si vous changez de config

## Comment ça marche

### 1. En développement (localhost)

```
┌─────────────┐
│  Navigateur │
└──────┬──────┘
       │ HTTP (port 3000)
       ▼
┌─────────────┐
│  Next.js    │  → NODE_ENV=development
└─────────────┘  → Cookie: Secure=false ✓
```

**Résultat:** Cookie CSRF **non sécurisé** (OK pour HTTP)

### 2. En production avec Nginx (HTTPS)

```
┌─────────────┐
│  Navigateur │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│    Nginx    │  → Envoie: X-Forwarded-Proto: https
└──────┬──────┘
       │ HTTP (localhost:3000)
       ▼
┌─────────────┐
│  Next.js    │  → Lit: X-Forwarded-Proto: https
└─────────────┘  → Cookie: Secure=true ✓
```

**Résultat:** Cookie CSRF **sécurisé** (requis pour HTTPS)

### 3. En production mal configurée (sans X-Forwarded-Proto)

```
┌─────────────┐
│  Navigateur │
└──────┬──────┘
       │ HTTPS
       ▼
┌─────────────┐
│    Nginx    │  → ⚠️ N'envoie PAS X-Forwarded-Proto
└──────┬──────┘
       │ HTTP (localhost:3000)
       ▼
┌─────────────┐
│  Next.js    │  → NODE_ENV=production
└─────────────┘  → Cookie: Secure=true (par défaut)
                → ❌ PROBLÈME: Cookie Secure sur HTTP!
```

**Résultat:** Cookie CSRF **non défini** (le navigateur le bloque)
**Solution:** Configurer Nginx correctement (voir ci-dessous)

## Configuration Nginx requise

Pour que la détection fonctionne, Nginx **DOIT** envoyer le header `X-Forwarded-Proto`:

```nginx
location / {
    proxy_pass http://localhost:3000;

    # ⭐ LIGNE CRUCIALE
    proxy_set_header X-Forwarded-Proto $scheme;

    # Autres headers recommandés
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

## Code Source

### Fichier: `lib/csrf-core.ts`

```typescript
function isSecureContext(headers?: Headers): boolean {
  // En développement, jamais de cookies sécurisés
  if (!isProd()) return false;

  // ⭐ DÉTECTION DYNAMIQUE via X-Forwarded-Proto
  if (headers) {
    const forwardedProto = headers.get('x-forwarded-proto');
    if (forwardedProto) {
      return forwardedProto === 'https';
    }
  }

  // Fallback: par défaut sécurisé en production
  return isProd();
}

export function getCsrfCookieOptions(headers?: Headers) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: isSecureContext(headers), // 👈 Détection dynamique
    maxAge: CSRF_TTL_SECONDS,
  };
}
```

### Fichier: `middleware.ts`

```typescript
if (!csrfToken) {
  response.cookies.set({
    name: CSRF_COOKIE_NAME,
    value: generateCsrfToken(),
    ...getCsrfCookieOptions(request.headers), // 👈 Passe les headers
  });
}
```

## Vérification

### Tester la détection

```bash
# En développement (HTTP)
./check-csrf.sh http://localhost:3000
# → Cookie: Secure=false

# En production (HTTPS)
./check-csrf.sh https://votre-domaine.com
# → Cookie: Secure=true
```

### Vérifier les headers reçus

Créez temporairement `app/api/debug/headers/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    forwardedProto: request.headers.get('x-forwarded-proto'),
    nodeEnv: process.env.NODE_ENV,
    secure: request.headers.get('x-forwarded-proto') === 'https',
  });
}
```

Visitez: `https://votre-domaine.com/api/debug/headers`

Devrait retourner:
```json
{
  "forwardedProto": "https",
  "nodeEnv": "production",
  "secure": true
}
```

⚠️ **Supprimez ce fichier après le test!**

## Fallback (si nécessaire)

Si vous ne pouvez pas configurer Nginx, vous pouvez toujours utiliser la variable d'environnement:

```bash
# Dans .env
FORCE_SECURE_COOKIES=false
```

⚠️ **Attention:** Ceci désactive les cookies sécurisés partout! À utiliser **uniquement** pour le debugging.

## Logs de diagnostic

En production, si le header `X-Forwarded-Proto` n'est pas `https`, vous verrez dans les logs:

```
⚠️  CSRF: Connexion non-HTTPS en production (X-Forwarded-Proto: http)
```

Cela indique que Nginx envoie bien le header, mais que la connexion originale est en HTTP (ce qui est anormal en production).

## Résumé

| Environnement | X-Forwarded-Proto | Cookie Secure | Résultat |
|---------------|-------------------|---------------|----------|
| Dev (HTTP) | - | `false` | ✅ OK |
| Prod + Nginx bien configuré | `https` | `true` | ✅ OK |
| Prod + Nginx mal configuré | - | `true` (défaut) | ❌ Cookie bloqué |
| Prod + Nginx mal configuré | `http` | `false` | ⚠️ Fonctionne mais non sécurisé |

## Questions fréquentes

### Q: Dois-je redéployer après avoir configuré Nginx?

**R:** Non! La détection est dynamique. Il suffit de recharger Nginx:
```bash
sudo systemctl reload nginx
```

### Q: Comment savoir si ça fonctionne?

**R:** Utilisez le script de diagnostic:
```bash
./check-csrf.sh https://votre-domaine.com
```

### Q: Et si j'utilise Apache?

**R:** Ajoutez dans votre VirtualHost:
```apache
RequestHeader set X-Forwarded-Proto "https"
```

### Q: Puis-je désactiver la détection dynamique?

**R:** Oui, avec `FORCE_SECURE_COOKIES=false` dans `.env`, mais ce n'est **pas recommandé** en production.

## Avantages par rapport à l'ancienne méthode

### Avant (statique)
```typescript
secure: process.env.NODE_ENV === "production"
```
- ❌ Ne fonctionne pas avec reverse proxy HTTP→HTTPS
- ❌ Nécessite FORCE_SECURE_COOKIES=false
- ❌ Moins sécurisé

### Maintenant (dynamique)
```typescript
secure: isSecureContext(headers)
```
- ✅ Détection automatique du protocole
- ✅ Pas de configuration nécessaire
- ✅ S'adapte à l'environnement
- ✅ Plus sécurisé

## Références

- [MDN: Secure Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies#restrict_access_to_cookies)
- [Next.js: Behind a Proxy](https://nextjs.org/docs/app/building-your-application/deploying#behind-a-proxy)
- [Nginx: X-Forwarded Headers](https://www.nginx.com/resources/wiki/start/topics/examples/forwarded/)
