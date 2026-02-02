#!/bin/bash

echo "🖼️  Test des images en production"
echo "════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variables
DOMAIN=${1:-""}
UPLOAD_DIR="public/uploads"

if [ -z "$DOMAIN" ]; then
    echo -e "${YELLOW}Usage:${NC} $0 https://votre-domaine.com"
    echo ""
    echo "Exemple:"
    echo "  $0 https://taxes.example.com"
    echo "  $0 https://app.taxes.example.com  # Pour sous-domaines"
    echo ""
    exit 1
fi

echo "🌐 Domaine: $DOMAIN"
echo ""

# Test 1: Vérifier le dossier local
echo "═══════════════════════════════════════════════"
echo "📁 Test 1: Dossier uploads local"
echo "═══════════════════════════════════════════════"
echo ""

if [ -d "$UPLOAD_DIR" ]; then
    echo -e "  ${GREEN}✓${NC} Dossier existe: $UPLOAD_DIR"

    FILE_COUNT=$(find "$UPLOAD_DIR" -type f 2>/dev/null | wc -l)
    echo "  📊 Nombre de fichiers: $FILE_COUNT"

    # Permissions
    PERMS=$(stat -f "%A" "$UPLOAD_DIR" 2>/dev/null || stat -c "%a" "$UPLOAD_DIR" 2>/dev/null)
    echo "  🔐 Permissions: $PERMS"

    if [ "$PERMS" -lt 755 ]; then
        echo -e "  ${YELLOW}⚠${NC}  Permissions trop restrictives (recommandé: 755)"
    else
        echo -e "  ${GREEN}✓${NC} Permissions correctes"
    fi
else
    echo -e "  ${RED}✗${NC} Dossier n'existe pas: $UPLOAD_DIR"
    echo "  → Créez-le: mkdir -p $UPLOAD_DIR"
fi

echo ""

# Test 2: Trouver un fichier exemple
echo "═══════════════════════════════════════════════"
echo "🔍 Test 2: Fichier exemple"
echo "═══════════════════════════════════════════════"
echo ""

SAMPLE_FILE=$(find "$UPLOAD_DIR" -type f 2>/dev/null | head -n1)

if [ -n "$SAMPLE_FILE" ]; then
    echo -e "  ${GREEN}✓${NC} Fichier trouvé: $SAMPLE_FILE"

    # Obtenir juste le nom du fichier relatif à public/
    RELATIVE_PATH=${SAMPLE_FILE#public/}
    echo "  📍 Chemin relatif: /$RELATIVE_PATH"

    # Test 3: Accès HTTP
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "🌐 Test 3: Accès HTTP"
    echo "═══════════════════════════════════════════════"
    echo ""

    IMAGE_URL="$DOMAIN/$RELATIVE_PATH"
    echo "  🔗 URL testée: $IMAGE_URL"
    echo ""

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$IMAGE_URL" --connect-timeout 5 2>/dev/null)

    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "  ${GREEN}✓${NC} Image accessible (HTTP $HTTP_CODE)"

        # Vérifier le Content-Type
        CONTENT_TYPE=$(curl -sI "$IMAGE_URL" | grep -i "content-type:" | awk '{print $2}' | tr -d '\r')
        echo "  📄 Content-Type: $CONTENT_TYPE"

        if echo "$CONTENT_TYPE" | grep -qi "image"; then
            echo -e "  ${GREEN}✓${NC} Type MIME correct"
        else
            echo -e "  ${YELLOW}⚠${NC}  Type MIME inattendu"
        fi

    elif [ "$HTTP_CODE" == "403" ]; then
        echo -e "  ${RED}✗${NC} Accès refusé (HTTP 403)"
        echo "  → Problème de permissions"
        echo "  → Vérifiez: sudo chown -R www-data:www-data public/uploads/"
        echo "  → Vérifiez: sudo chmod -R 755 public/uploads/"

    elif [ "$HTTP_CODE" == "404" ]; then
        echo -e "  ${RED}✗${NC} Fichier introuvable (HTTP 404)"
        echo "  → Problème de configuration Nginx"
        echo "  → Vérifiez la section location /uploads/ dans Nginx"

    else
        echo -e "  ${RED}✗${NC} Erreur HTTP $HTTP_CODE"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Aucun fichier trouvé dans $UPLOAD_DIR"
    echo "  → Uploadez des images ou vérifiez le chemin"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "🔧 Test 4: Configuration Nginx"
echo "═══════════════════════════════════════════════"
echo ""

if [ -f "/etc/nginx/sites-enabled/taxes-app" ]; then
    echo "  Configuration trouvée: /etc/nginx/sites-enabled/taxes-app"

    if grep -q "location /uploads/" "/etc/nginx/sites-enabled/taxes-app"; then
        echo -e "  ${GREEN}✓${NC} Section /uploads/ présente"

        ALIAS=$(grep -A5 "location /uploads/" "/etc/nginx/sites-enabled/taxes-app" | grep "alias" | awk '{print $2}' | tr -d ';')
        if [ -n "$ALIAS" ]; then
            echo "  📍 Alias configuré: $ALIAS"
        fi
    else
        echo -e "  ${RED}✗${NC} Section /uploads/ manquante"
        echo "  → Ajoutez dans Nginx:"
        echo ""
        echo "    location /uploads/ {"
        echo "        alias $(pwd)/public/uploads/;"
        echo "        expires 30d;"
        echo "        add_header Cache-Control \"public, immutable\";"
        echo "    }"
    fi
else
    echo -e "  ${YELLOW}⚠${NC}  Configuration Nginx non trouvée à l'emplacement standard"
    echo "  → Vérifiez: /etc/nginx/sites-enabled/"
fi

echo ""
echo "═══════════════════════════════════════════════"
echo "📋 Résumé"
echo "═══════════════════════════════════════════════"
echo ""

if [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Configuration correcte!${NC}"
    echo ""
    echo "Les images sont accessibles depuis:"
    echo "  $DOMAIN/uploads/..."
else
    echo -e "${YELLOW}⚠  Problème détecté${NC}"
    echo ""
    echo "Actions recommandées:"
    echo ""

    if [ "$HTTP_CODE" == "403" ]; then
        echo "1. Corriger les permissions:"
        echo "   sudo chown -R www-data:www-data public/uploads/"
        echo "   sudo chmod -R 755 public/uploads/"
        echo ""
    fi

    if [ "$HTTP_CODE" == "404" ]; then
        echo "1. Vérifier la configuration Nginx:"
        echo "   sudo nano /etc/nginx/sites-enabled/taxes-app"
        echo ""
        echo "2. Ajouter la section location /uploads/ (si absente)"
        echo ""
        echo "3. Recharger Nginx:"
        echo "   sudo nginx -t && sudo systemctl reload nginx"
        echo ""
    fi

    echo "4. Relancer ce script pour vérifier:"
    echo "   $0 $DOMAIN"
fi

echo ""
echo "📚 Documentation complète: TROUBLESHOOTING-IMAGES.md"
echo ""
