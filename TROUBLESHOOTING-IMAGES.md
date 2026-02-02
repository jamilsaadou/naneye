# 🖼️ Dépannage des images en production

## Problème: Les photos ne s'affichent pas en production

### Causes possibles et solutions

## ✅ Solution 1: Créer le dossier uploads avec les bonnes permissions

```bash
# Sur le serveur de production
cd /chemin/vers/votre/app

# Créer le dossier uploads s'il n'existe pas
mkdir -p public/uploads

# Donner les bonnes permissions (lecture/écriture pour l'utilisateur Node.js)
chmod 755 public/uploads

# Si vous utilisez un utilisateur spécifique (ex: www-data)
chown -R www-data:www-data public/uploads

# Ou pour l'utilisateur actuel
chown -R $USER:$USER public/uploads
```

## ✅ Solution 2: Vérifier la configuration Next.js

Ajoutez cette configuration dans `next.config.mjs`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Configuration des images
  images: {
    domains: ['localhost', 'votre-domaine.com'],
    unoptimized: true, // Si vous servez les images directement
  },

  // S'assurer que les fichiers statiques sont copiés
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};

export default nextConfig;
```

## ✅ Solution 3: Ajouter uploads au .gitignore (recommandé)

Les fichiers uploadés ne devraient PAS être dans Git. Créez plutôt une stratégie de backup.

Ajoutez dans `.gitignore`:

```gitignore
# Fichiers uploadés par les utilisateurs
public/uploads/*
!public/uploads/.gitkeep
```

Puis créez un fichier `.gitkeep`:

```bash
touch public/uploads/.gitkeep
git add public/uploads/.gitkeep
```

## ✅ Solution 4: Script de déploiement

Créez un script `setup-uploads.sh`:

```bash
#!/bin/bash

echo "Configuration du dossier uploads..."

# Créer le dossier s'il n'existe pas
mkdir -p public/uploads

# Permissions appropriées
chmod 755 public/uploads

# Si vous êtes root, donner les permissions à l'utilisateur Node.js
if [ "$EUID" -eq 0 ]; then
  chown -R www-data:www-data public/uploads
  echo "✓ Permissions définies pour www-data"
else
  echo "✓ Permissions définies pour l'utilisateur actuel"
fi

echo "✓ Configuration terminée!"
```

Rendez-le exécutable:

```bash
chmod +x setup-uploads.sh
./setup-uploads.sh
```

## ✅ Solution 5: Configuration Nginx (si applicable)

Si vous utilisez Nginx comme reverse proxy, ajoutez cette configuration:

```nginx
server {
    listen 80;
    server_name votre-domaine.com;

    # Servir les fichiers statiques directement
    location /uploads/ {
        alias /chemin/vers/votre/app/public/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Proxy vers Next.js pour le reste
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Puis redémarrer Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## ✅ Solution 6: Vérifier les permissions de lecture

```bash
# Vérifier les permissions du dossier
ls -la public/uploads/

# Le dossier devrait ressembler à:
# drwxr-xr-x  user group  public/uploads/

# Corriger si nécessaire
chmod -R 755 public/uploads/
```

## ✅ Solution 7: Debugging en production

Ajoutez des logs pour déboguer:

Créez `scripts/check-uploads.js`:

```javascript
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const uploadDir = join(process.cwd(), 'public', 'uploads');

console.log('Vérification du dossier uploads...\n');
console.log('Chemin:', uploadDir);
console.log('Existe:', existsSync(uploadDir));

if (!existsSync(uploadDir)) {
  console.log('❌ Le dossier n\'existe pas!');
  console.log('Création du dossier...');
  mkdirSync(uploadDir, { recursive: true });
  console.log('✓ Dossier créé');
} else {
  const files = readdirSync(uploadDir);
  console.log('✓ Dossier existe');
  console.log('Nombre de fichiers:', files.length);
  if (files.length > 0) {
    console.log('Fichiers:', files.slice(0, 5).join(', '));
  }
}
```

Exécutez:

```bash
node scripts/check-uploads.js
```

## ✅ Solution 8: Utiliser un stockage externe (recommandé pour la production)

Pour une vraie production, utilisez un service de stockage externe:

### Option A: AWS S3

```bash
npm install @aws-sdk/client-s3
```

### Option B: Cloudinary

```bash
npm install cloudinary
```

### Option C: Serveur de fichiers séparé

Configurez un serveur dédié aux fichiers statiques.

## 🔍 Diagnostic rapide

Exécutez ces commandes sur le serveur de production:

```bash
# 1. Vérifier l'existence du dossier
ls -la public/uploads/

# 2. Vérifier les permissions
stat public/uploads/

# 3. Tester l'accès en lecture
cat public/uploads/.gitkeep 2>/dev/null && echo "✓ Lecture OK" || echo "❌ Problème de lecture"

# 4. Tester l'accès en écriture
touch public/uploads/test.txt && rm public/uploads/test.txt && echo "✓ Écriture OK" || echo "❌ Problème d'écriture"

# 5. Vérifier via HTTP
curl -I http://localhost:3000/uploads/.gitkeep
# Devrait retourner 200 OK
```

## 📊 Checklist de vérification

- [ ] Le dossier `public/uploads/` existe
- [ ] Les permissions sont correctes (755 ou 775)
- [ ] L'utilisateur Node.js a accès au dossier
- [ ] Les fichiers sont accessibles via HTTP
- [ ] Le middleware Next.js ne bloque pas `/uploads`
- [ ] Nginx/Apache est correctement configuré (si utilisé)
- [ ] Les fichiers existent physiquement sur le disque

## 🆘 Toujours des problèmes?

1. Vérifiez les logs du serveur:
```bash
pm2 logs
# ou
journalctl -u votre-service -f
```

2. Testez l'accès direct à un fichier:
```bash
curl -I http://votre-domaine.com/uploads/nom-fichier.jpg
```

3. Vérifiez les headers de réponse pour voir s'il y a des erreurs 403 ou 404

4. Assurez-vous que le build Next.js est à jour:
```bash
npm run build
```
