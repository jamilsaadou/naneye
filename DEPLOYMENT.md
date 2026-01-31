# Guide de déploiement en production

## 📋 Prérequis

- Node.js 18+ installé
- PostgreSQL configuré
- Variables d'environnement configurées dans `.env`

## 🔧 Configuration de la base de données

### 1. Variables d'environnement requises

Créez un fichier `.env` à la racine du projet avec les variables suivantes:

```bash
# Base de données
DATABASE_URL="postgresql://user:password@localhost:5432/database_name"

# Sécurité (IMPORTANT: Générez des valeurs aléatoires sécurisées)
SESSION_SECRET="votre-secret-session-tres-long-et-aleatoire-32-chars-minimum"

# Configuration de l'admin initial (pour seed-prod)
ADMIN_EMAIL="admin@votre-domaine.com"
ADMIN_PASSWORD="VotreMotDePasseSecurise@123"

# Configuration de la municipalité
MUNICIPALITY_NAME="Nom de votre commune"

# Environnement
NODE_ENV="production"
```

### 2. Générer des secrets sécurisés

```bash
# Générer un secret aléatoire pour SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 🚀 Déploiement initial

### Étape 1: Installer les dépendances

```bash
npm install
```

### Étape 2: Appliquer les migrations

```bash
npm run prisma:migrate:deploy
```

Cette commande applique toutes les migrations sans mode interactif.

### Étape 3: Générer le client Prisma

```bash
npm run prisma:generate
```

### Étape 4: Seed de production (uniquement admin)

```bash
npm run prisma:seed:prod
```

Cette commande créera:
- Un super administrateur avec les identifiants définis dans `.env`
- Les paramètres de base de l'application

**⚠️ Alternative - Seed complet avec données de test:**

```bash
npm run prisma:seed
```

Utilisez cette option uniquement pour un environnement de développement ou de test.
Cette commande créera des données d'exemple (contribuables, taxes, etc.)

### Étape 5: Build de l'application

```bash
npm run build
```

### Étape 6: Démarrer l'application

```bash
npm run start
```

L'application sera accessible sur `http://localhost:3000`

## 🔄 Mise à jour de l'application

Lors d'une mise à jour:

```bash
# 1. Récupérer les dernières modifications
git pull

# 2. Installer les nouvelles dépendances
npm install

# 3. Appliquer les nouvelles migrations
npm run prisma:migrate:deploy

# 4. Régénérer le client Prisma
npm run prisma:generate

# 5. Rebuild l'application
npm run build

# 6. Redémarrer l'application
npm run start
```

## 👤 Créer des utilisateurs supplémentaires

Une fois connecté en tant que super admin, vous pouvez créer d'autres utilisateurs via l'interface:

1. Connectez-vous avec vos identifiants admin
2. Allez dans **Gestion des utilisateurs**
3. Créez des utilisateurs avec les rôles appropriés:
   - **SUPER_ADMIN**: Accès complet
   - **ADMIN**: Gestion de la commune
   - **AGENT**: Enregistrement des contribuables
   - **CAISSIER**: Gestion des paiements
   - **AUDITEUR**: Consultation uniquement

## 🔐 Sécurité

### Checklist de sécurité en production:

- [ ] Utilisez `NODE_ENV=production`
- [ ] Générez un `SESSION_SECRET` unique et sécurisé (32+ caractères)
- [ ] Changez les mots de passe par défaut
- [ ] Utilisez HTTPS en production
- [ ] Configurez un pare-feu pour PostgreSQL
- [ ] Activez les sauvegardes automatiques de la base de données
- [ ] Limitez l'accès SSH au serveur

## 🗄️ Sauvegarde de la base de données

### Créer une sauvegarde

```bash
pg_dump -U username -h localhost database_name > backup_$(date +%Y%m%d).sql
```

### Restaurer une sauvegarde

```bash
psql -U username -h localhost database_name < backup_20260201.sql
```

## 📊 Monitoring

### Vérifier l'état de l'application

```bash
# Vérifier les processus Node.js
ps aux | grep node

# Vérifier les logs
tail -f /var/log/app.log
```

### Vérifier la base de données

```bash
# Se connecter à PostgreSQL
psql -U username -d database_name

# Vérifier le nombre d'utilisateurs
SELECT COUNT(*) FROM "User";

# Vérifier les migrations appliquées
SELECT * FROM "_prisma_migrations" ORDER BY finished_at DESC LIMIT 5;
```

## 🐛 Dépannage

### Erreur: "Token CSRF invalide"

Assurez-vous que:
- Les cookies sont activés dans le navigateur
- L'application est accessible via le même domaine (pas de redirection)

### Erreur: "Identifiants invalides"

1. Vérifiez que le seed a bien été exécuté:
```bash
npm run prisma:seed:prod
```

2. Vérifiez les identifiants dans la base de données:
```bash
psql -U username -d database_name -c "SELECT email, role FROM \"User\";"
```

### L'application ne démarre pas

1. Vérifiez les logs
2. Vérifiez que PostgreSQL est démarré
3. Vérifiez la connexion à la base de données
4. Vérifiez que toutes les variables d'environnement sont définies

## 📝 Notes

- En production, n'utilisez jamais le seed de développement (`prisma:seed`)
- Sauvegardez régulièrement votre base de données
- Gardez vos dépendances à jour pour les correctifs de sécurité
- Utilisez un processus manager comme PM2 pour la production

## 🔗 Ressources

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Prisma](https://www.prisma.io/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
