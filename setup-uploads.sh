#!/bin/bash

echo "🖼️  Configuration du dossier uploads..."
echo ""

# Créer le dossier s'il n'existe pas
if [ ! -d "public/uploads" ]; then
  echo "📁 Création du dossier public/uploads..."
  mkdir -p public/uploads
  echo "✓ Dossier créé"
else
  echo "✓ Le dossier public/uploads existe déjà"
fi

# Créer le fichier .gitkeep
if [ ! -f "public/uploads/.gitkeep" ]; then
  echo "📝 Création du fichier .gitkeep..."
  touch public/uploads/.gitkeep
  echo "✓ Fichier .gitkeep créé"
fi

# Définir les permissions appropriées
echo "🔒 Configuration des permissions..."
chmod 755 public/uploads

# Si exécuté en tant que root, définir le propriétaire
if [ "$EUID" -eq 0 ]; then
  # Demander l'utilisateur
  read -p "Nom de l'utilisateur Node.js (par défaut: www-data): " NODE_USER
  NODE_USER=${NODE_USER:-www-data}

  if id "$NODE_USER" &>/dev/null; then
    chown -R "$NODE_USER:$NODE_USER" public/uploads
    echo "✓ Propriétaire défini: $NODE_USER"
  else
    echo "⚠️  Utilisateur $NODE_USER non trouvé, permissions non modifiées"
  fi
else
  echo "✓ Permissions définies pour l'utilisateur actuel"
fi

# Vérifier les permissions
echo ""
echo "📊 État actuel:"
ls -lah public/uploads/ | head -3

echo ""
echo "✅ Configuration terminée!"
echo ""
echo "Pour vérifier que tout fonctionne:"
echo "  1. Démarrez l'application: npm run start"
echo "  2. Uploadez une photo via l'interface"
echo "  3. Vérifiez que le fichier apparaît dans public/uploads/"
