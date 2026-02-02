# 🏛️ Système de Gestion des Taxes

Application web complète de gestion des contribuables, taxes, paiements et recouvrements pour les administrations fiscales.

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Technologies](#-technologies)
- [Installation](#-installation)
- [Configuration des URLs](#-configuration-des-urls)
- [Déploiement en production](#-déploiement-en-production)
- [Configuration Nginx](#-configuration-nginx)
- [Variables d'environnement](#-variables-denvironnement)
- [API REST](#-api-rest)
- [Dépannage](#-dépannage)

## ✨ Fonctionnalités

- **Gestion des contribuables** - Enregistrement, recherche, profils détaillés
- **Évaluations fiscales** - Calcul et suivi des taxes (foncières, professionnelles, etc.)
- **Paiements** - Enregistrement, historique, rapports
- **Recouvrements** - Suivi des créances, relances
- **Collecteurs externes** - API pour intégration de systèmes tiers
- **Rapports et statistiques** - Tableaux de bord, exports PDF/Excel
- **Gestion des utilisateurs** - Rôles et permissions (admin, collecteur, visualiseur)
- **Logs d'audit** - Traçabilité complète des actions

## 🛠️ Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Base de données**: PostgreSQL
- **Authentification**: Sessions sécurisées avec JWT
- **Sécurité**: CSRF protection dynamique, cookies sécurisés
- **Déploiement**: PM2, Nginx, Let's Encrypt SSL

## 📦 Installation

### Prérequis

- Node.js 18+ et npm
- PostgreSQL 14+
- Git

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd "Gestion des taxes"
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer la base de données

```bash
# Créer la base de données PostgreSQL
createdb gestion_taxes

# Copier le fichier d'environnement
cp .env.example .env
```

### 4. Configurer les variables d'environnement

Éditez le fichier `.env`:

```bash
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/gestion_taxes"

# Session (générer une clé secrète forte)
SESSION_SECRET="votre-secret-très-long-et-aléatoire"

# Environnement
NODE_ENV="development"

# Admin par défaut
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="MotDePasseSecurise123!"

# URLs (pour développement local)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"
```

### 5. Initialiser la base de données

```bash
# Appliquer les migrations
npx prisma migrate deploy

# Générer le client Prisma
npx prisma generate

# Créer l'utilisateur admin
npm run seed:prod
```

### 6. Lancer en développement

```bash
npm run dev
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

**Identifiants par défaut:**
- Email: `admin@example.com`
- Mot de passe: celui défini dans `ADMIN_PASSWORD`

## 🌐 Configuration des URLs

### Développement local

En local, l'application utilise `localhost:3000`:

```bash
# .env
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_API_BASE_URL="http://localhost:3000/api"
```

### Production avec nom de domaine

#### Étape 1: Enregistrer un nom de domaine

Achetez un nom de domaine auprès d'un registrar (ex: Namecheap, OVH, GoDaddy).

#### Étape 2: Configurer les DNS

Pointez votre domaine vers votre serveur en créant un enregistrement A:

```
Type: A
Nom: @
Valeur: 123.45.67.89 (adresse IP de votre serveur)
TTL: 3600

Type: A
Nom: www
Valeur: 123.45.67.89
TTL: 3600
```

**Vérification DNS:**
```bash
# Vérifier que le domaine pointe vers votre serveur
nslookup votre-domaine.com
dig votre-domaine.com
```

La propagation DNS peut prendre de 1 à 48 heures.

#### Étape 3: Mettre à jour les URLs dans .env

```bash
# .env (sur le serveur de production)
NEXT_PUBLIC_APP_URL="https://votre-domaine.com"
NEXT_PUBLIC_API_BASE_URL="https://votre-domaine.com/api"
```

#### Étape 4: Configurer Nginx et SSL

Voir la section [Configuration Nginx](#-configuration-nginx) ci-dessous.

### 🔀 Configuration avec sous-domaines séparés (RECOMMANDÉ)

Pour une architecture plus professionnelle, vous pouvez utiliser deux sous-domaines distincts:

**Architecture:**
- Frontend: `https://app.votre-domaine.com`
- API: `https://api.votre-domaine.com`

**Avantages:**
- ✅ Séparation claire frontend/API
- ✅ Évolutivité (possibilité de séparer sur 2 serveurs)
- ✅ Sécurité renforcée
- ✅ Gestion simplifiée du cache

**Configuration:**

Les deux sous-domaines pointent vers la **même adresse IP**, et Nginx route les requêtes:

```bash
# Configuration DNS
app.votre-domaine.com → 123.45.67.89
api.votre-domaine.com → 123.45.67.89

# Variables d'environnement
NEXT_PUBLIC_APP_URL="https://app.votre-domaine.com"
NEXT_PUBLIC_API_BASE_URL="https://api.votre-domaine.com"
ALLOWED_ORIGINS="https://app.votre-domaine.com"
```

**Important:** Cette configuration nécessite:
- Configuration CORS (domaines différents)
- Cookies `sameSite: "none"` pour cross-domain
- Deux certificats SSL (ou un wildcard)

**📚 Guide complet:** [docs/CONFIGURATION-SOUS-DOMAINES.md](./docs/CONFIGURATION-SOUS-DOMAINES.md)

**🧪 Script de diagnostic:**
```bash
chmod +x check-subdomains.sh
./check-subdomains.sh app.votre-domaine.com api.votre-domaine.com
```

### URLs de l'API

L'API est accessible aux endpoints suivants:

```
Base URL: https://votre-domaine.com/api

Authentification:
  POST /api/auth/login
  POST /api/auth/logout
  GET  /api/auth/me

Contribuables:
  GET    /api/taxpayers
  POST   /api/taxpayers
  GET    /api/taxpayers/:id
  PATCH  /api/taxpayers/:id
  DELETE /api/taxpayers/:id

Paiements:
  GET  /api/payments
  POST /api/payments
  GET  /api/payments/:id

Évaluations:
  GET    /api/assessments
  POST   /api/assessments
  PATCH  /api/assessments/:id

Collecteurs externes (API publique):
  POST /api/collector/taxpayers
  POST /api/collector/payments
  GET  /api/collector/taxpayers/:nif
```

**Documentation complète:** Voir [API-COLLECTEURS.md](./API-COLLECTEURS.md)

## 🚀 Déploiement en production

### 1. Préparer le serveur

```bash
# Mettre à jour le système
sudo apt update && sudo apt upgrade -y

# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Installer Nginx
sudo apt install -y nginx

# Installer PM2 (process manager)
sudo npm install -g pm2
```

### 2. Cloner et configurer l'application

```bash
# Créer un utilisateur dédié
sudo useradd -m -s /bin/bash taxapp
sudo su - taxapp

# Cloner le projet
git clone <url-du-repo> app
cd app

# Installer les dépendances
npm install

# Configurer .env pour la production
cp .env.example .env
nano .env
```

Configuration `.env` pour production:

```bash
NODE_ENV="production"
DATABASE_URL="postgresql://taxapp:password@localhost:5432/gestion_taxes"
SESSION_SECRET="<générer-une-clé-secrète-forte>"

ADMIN_EMAIL="admin@votre-domaine.com"
ADMIN_PASSWORD="<mot-de-passe-fort>"

NEXT_PUBLIC_APP_URL="https://votre-domaine.com"
NEXT_PUBLIC_API_BASE_URL="https://votre-domaine.com/api"
```

### 3. Initialiser la base de données

```bash
# Créer la base de données
sudo -u postgres psql
CREATE DATABASE gestion_taxes;
CREATE USER taxapp WITH PASSWORD 'votre-mot-de-passe';
GRANT ALL PRIVILEGES ON DATABASE gestion_taxes TO taxapp;
\q

# Appliquer les migrations
npx prisma migrate deploy
npx prisma generate

# Créer l'admin
npm run seed:prod
```

### 4. Construire l'application

```bash
npm run build
```

### 5. Configurer les uploads

```bash
# Créer et configurer le dossier des uploads
chmod +x setup-uploads.sh
./setup-uploads.sh

# Vérifier la configuration
node check-uploads.js
```

### 6. Démarrer avec PM2

```bash
# Démarrer l'application
pm2 start npm --name "taxes-app" -- start

# Configurer le démarrage automatique
pm2 startup
pm2 save

# Vérifier le statut
pm2 status
pm2 logs taxes-app
```

## 🔧 Configuration Nginx

### 1. Obtenir un certificat SSL

```bash
# Installer Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtenir le certificat
sudo certbot --nginx -d votre-domaine.com -d www.votre-domaine.com
```

### 2. Configurer Nginx

Créez `/etc/nginx/sites-available/taxes-app`:

```nginx
# Redirection HTTP → HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name votre-domaine.com www.votre-domaine.com;
    return 301 https://$server_name$request_uri;
}

# Configuration HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name votre-domaine.com www.votre-domaine.com;

    # Certificats SSL (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/votre-domaine.com/privkey.pem;

    # Paramètres SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de sécurité
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    # Fichiers uploadés
    location /uploads/ {
        alias /home/taxapp/app/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Fichiers statiques Next.js
    location /_next/static/ {
        proxy_pass http://localhost:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy vers Next.js
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # ⭐ CRUCIAL pour les cookies sécurisés
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Port $server_port;

        proxy_cache_bypass $http_upgrade;
    }

    # Logs
    access_log /var/log/nginx/taxes_access.log;
    error_log /var/log/nginx/taxes_error.log warn;

    client_max_body_size 10M;
}
```

### 3. Activer la configuration

```bash
# Créer le lien symbolique
sudo ln -s /etc/nginx/sites-available/taxes-app /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Recharger Nginx
sudo systemctl reload nginx
```

**Configuration complète:** Voir [nginx.conf.example](./nginx.conf.example)

## 📝 Variables d'environnement

### Variables obligatoires

| Variable | Description | Exemple |
|----------|-------------|---------|
| `DATABASE_URL` | URL de connexion PostgreSQL | `postgresql://user:pass@localhost:5432/db` |
| `SESSION_SECRET` | Clé secrète pour les sessions (min 32 caractères) | `votre-secret-tres-long-et-aleatoire` |
| `NODE_ENV` | Environnement d'exécution | `development` ou `production` |
| `ADMIN_EMAIL` | Email de l'administrateur par défaut | `admin@example.com` |
| `ADMIN_PASSWORD` | Mot de passe de l'admin (min 8 caractères) | `MotDePasse123!` |

### Variables publiques (frontend)

| Variable | Description | Exemple |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | URL complète de l'application | `https://taxes.example.com` |
| `NEXT_PUBLIC_API_BASE_URL` | URL de base de l'API | `https://taxes.example.com/api` |

### Variables optionnelles

| Variable | Description | Défaut |
|----------|-------------|--------|
| `FORCE_SECURE_COOKIES` | Force désactivation cookies sécurisés (debug uniquement) | - |
| `PORT` | Port du serveur Next.js | `3000` |

**Important:**
- Ne commitez JAMAIS le fichier `.env` dans Git
- Utilisez `.env.example` comme template
- Générez une clé `SESSION_SECRET` unique et forte pour chaque environnement

```bash
# Générer une clé secrète forte
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🔌 API REST

### Authentification

Toutes les requêtes API (sauf endpoints publics `/api/collector/*`) nécessitent:

1. **Cookie de session** - Automatiquement envoyé après login
2. **Token CSRF** - Envoyé dans le header `x-csrf-token`

**Exemple de connexion:**

```javascript
// 1. Récupérer le token CSRF du cookie
const csrfToken = document.cookie
  .split('; ')
  .find(row => row.startsWith('csrf_token='))
  ?.split('=')[1];

// 2. Se connecter
const response = await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken
  },
  credentials: 'include', // Important pour les cookies
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});
```

### API Collecteurs (publique)

Pour les systèmes externes, une API sans authentification est disponible:

**Base URL:** `https://votre-domaine.com/api/collector`

**Endpoints:**
- `POST /taxpayers` - Créer/mettre à jour un contribuable
- `GET /taxpayers/:nif` - Récupérer un contribuable par NIF
- `POST /payments` - Enregistrer un paiement

**Documentation complète:** [API-COLLECTEURS.md](./API-COLLECTEURS.md)

## 🔍 Dépannage

### Erreur "Token CSRF manquant"

Cette erreur survient généralement en production avec Nginx.

**Diagnostic:**
```bash
./check-csrf.sh https://votre-domaine.com
```

**Solution:** Vérifier que Nginx transmet le header `X-Forwarded-Proto`

**Guide complet:** [TROUBLESHOOTING-CSRF.md](./TROUBLESHOOTING-CSRF.md)

**Comment ça marche:** [docs/CSRF-DETECTION-DYNAMIQUE.md](./docs/CSRF-DETECTION-DYNAMIQUE.md)

### Images ne s'affichent pas en production

**Diagnostic:**
```bash
node check-uploads.js
```

**Solutions:**
1. Vérifier les permissions du dossier `public/uploads/`
2. Vérifier la configuration Nginx pour `/uploads/`
3. S'assurer que les fichiers existent

**Guide complet:** [TROUBLESHOOTING-IMAGES.md](./TROUBLESHOOTING-IMAGES.md)

### Application ne démarre pas

```bash
# Vérifier les logs PM2
pm2 logs taxes-app

# Vérifier les erreurs de build
npm run build

# Vérifier la connexion à la base de données
npx prisma db pull
```

### Problèmes de connexion à la base de données

```bash
# Tester la connexion
psql -h localhost -U taxapp -d gestion_taxes

# Vérifier le statut PostgreSQL
sudo systemctl status postgresql

# Voir les logs PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-*.log
```

### Renouvellement automatique SSL

Certbot configure automatiquement le renouvellement. Vérifier:

```bash
# Tester le renouvellement
sudo certbot renew --dry-run

# Voir les tâches cron
sudo systemctl list-timers | grep certbot
```

## 📚 Documentation complémentaire

- [API-COLLECTEURS.md](./API-COLLECTEURS.md) - Documentation API externe
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guide de déploiement détaillé
- [TROUBLESHOOTING-CSRF.md](./TROUBLESHOOTING-CSRF.md) - Résolution problèmes CSRF
- [TROUBLESHOOTING-IMAGES.md](./TROUBLESHOOTING-IMAGES.md) - Résolution problèmes images
- [docs/CSRF-DETECTION-DYNAMIQUE.md](./docs/CSRF-DETECTION-DYNAMIQUE.md) - Fonctionnement CSRF dynamique

## 🔒 Sécurité

- **Authentification**: Sessions JWT sécurisées avec rotation automatique
- **CSRF Protection**: Détection dynamique HTTPS/HTTP avec tokens
- **Cookies sécurisés**: `Secure`, `HttpOnly`, `SameSite=Lax`
- **Mots de passe**: Hachage bcrypt avec salt
- **SQL Injection**: Protection via Prisma ORM
- **XSS**: Protection via React et sanitization
- **Headers de sécurité**: HSTS, X-Frame-Options, CSP

## 📄 Licence

Propriétaire - Tous droits réservés

## 🤝 Support

Pour toute question ou problème:
1. Consultez la documentation dans les fichiers `TROUBLESHOOTING-*.md`
2. Vérifiez les logs: `pm2 logs taxes-app`
3. Utilisez les scripts de diagnostic: `check-csrf.sh`, `check-uploads.js`

---

Développé avec ❤️ pour les administrations fiscales
