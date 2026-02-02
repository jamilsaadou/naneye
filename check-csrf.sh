#!/bin/bash

echo "🔒 Diagnostic du problème CSRF"
echo "═══════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
DOMAIN=${1:-"http://localhost:3000"}

echo "🌐 Domaine testé: $DOMAIN"
echo ""

# Test 1: Vérifier que le serveur répond
echo "📡 Test 1: Connexion au serveur..."
if curl -s -o /dev/null -w "%{http_code}" "$DOMAIN" | grep -q "200\|301\|302"; then
    echo -e "${GREEN}✓${NC} Serveur accessible"
else
    echo -e "${RED}✗${NC} Serveur non accessible"
    exit 1
fi
echo ""

# Test 2: Vérifier le cookie CSRF
echo "🍪 Test 2: Vérification du cookie CSRF..."
COOKIE_RESPONSE=$(curl -sI "$DOMAIN/login" | grep -i "set-cookie.*csrf_token")

if [ -n "$COOKIE_RESPONSE" ]; then
    echo -e "${GREEN}✓${NC} Cookie CSRF trouvé:"
    echo "   $COOKIE_RESPONSE"

    # Vérifier si le cookie est sécurisé
    if echo "$COOKIE_RESPONSE" | grep -qi "Secure"; then
        echo -e "   ${YELLOW}⚠${NC}  Cookie marqué comme Secure (HTTPS requis)"

        # Vérifier si on est en HTTP
        if [[ "$DOMAIN" == http://* ]]; then
            echo -e "   ${RED}✗${NC} PROBLÈME: Cookie Secure sur connexion HTTP!"
            echo "   → Le navigateur ne pourra pas lire ce cookie"
            echo ""
            echo -e "${YELLOW}Solutions:${NC}"
            echo "   1. Utilisez HTTPS: https://votre-domaine.com"
            echo "   2. Ajoutez dans .env: FORCE_SECURE_COOKIES=false (temporaire)"
            echo "   3. Configurez Nginx correctement (voir nginx.conf.example)"
        fi
    else
        echo -e "   ${GREEN}✓${NC} Cookie non sécurisé (OK pour HTTP)"
    fi
else
    echo -e "${RED}✗${NC} Cookie CSRF NON trouvé!"
    echo ""
    echo -e "${YELLOW}Causes possibles:${NC}"
    echo "   1. Le middleware Next.js ne s'exécute pas"
    echo "   2. Problème de build (essayez: npm run build)"
    echo "   3. L'application n'est pas démarrée correctement"
fi
echo ""

# Test 3: Vérifier les headers X-Forwarded-Proto
echo "🔍 Test 3: Headers de proxy..."
if [[ "$DOMAIN" == https://* ]]; then
    echo "   Connexion HTTPS détectée"
    echo "   → Nginx devrait envoyer: X-Forwarded-Proto: https"

    # Tester avec une requête API
    HEADERS=$(curl -sI "$DOMAIN/api/auth/me" 2>/dev/null)
    if echo "$HEADERS" | grep -qi "x-forwarded"; then
        echo -e "   ${GREEN}✓${NC} Headers X-Forwarded détectés"
    else
        echo -e "   ${YELLOW}⚠${NC}  Headers X-Forwarded non visibles (normal en HTTPS)"
    fi
else
    echo "   Connexion HTTP détectée"
    echo "   → Aucun header X-Forwarded-Proto requis"
fi
echo ""

# Test 4: Vérifier les variables d'environnement
echo "⚙️  Test 4: Configuration..."
if [ -f ".env" ]; then
    if grep -q "NODE_ENV=production" .env; then
        echo -e "   ${GREEN}✓${NC} NODE_ENV=production (cookies sécurisés en HTTPS)"
    else
        echo -e "   ${YELLOW}⚠${NC}  NODE_ENV non défini ou pas en production"
    fi

    if grep -q "FORCE_SECURE_COOKIES=false" .env; then
        echo -e "   ${YELLOW}⚠${NC}  FORCE_SECURE_COOKIES=false (cookies non sécurisés)"
        echo "   → OK pour debugging, PAS pour production HTTPS!"
    fi
else
    echo -e "   ${YELLOW}⚠${NC}  Fichier .env non trouvé"
fi
echo ""

# Test 5: Test de connexion complet
echo "🔐 Test 5: Simulation de connexion..."

# Récupérer le cookie CSRF
COOKIES=$(mktemp)
curl -sS -c "$COOKIES" "$DOMAIN/login" > /dev/null 2>&1

if [ -f "$COOKIES" ]; then
    CSRF_TOKEN=$(grep csrf_token "$COOKIES" | awk '{print $7}')

    if [ -n "$CSRF_TOKEN" ]; then
        echo -e "   ${GREEN}✓${NC} Token CSRF récupéré: ${CSRF_TOKEN:0:20}..."

        # Tester une connexion (va échouer sur les credentials mais devrait passer le CSRF)
        LOGIN_RESPONSE=$(curl -sS -b "$COOKIES" -X POST "$DOMAIN/api/auth/login" \
            -H "Content-Type: application/json" \
            -H "x-csrf-token: $CSRF_TOKEN" \
            -d '{"email":"test@example.com","password":"test"}' 2>&1)

        if echo "$LOGIN_RESPONSE" | grep -qi "Identifiants invalides"; then
            echo -e "   ${GREEN}✓${NC} CSRF OK (erreur de credentials attendue)"
        elif echo "$LOGIN_RESPONSE" | grep -qi "CSRF"; then
            echo -e "   ${RED}✗${NC} CSRF échoué: $LOGIN_RESPONSE"
        else
            echo -e "   ${YELLOW}⚠${NC}  Réponse inattendue: $LOGIN_RESPONSE"
        fi
    else
        echo -e "   ${RED}✗${NC} Token CSRF non récupéré du cookie"
    fi

    rm "$COOKIES"
else
    echo -e "   ${RED}✗${NC} Impossible de récupérer les cookies"
fi
echo ""

# Résumé
echo "═══════════════════════════════════════════"
echo "📋 Résumé"
echo ""

if [[ "$DOMAIN" == https://* ]]; then
    echo "✅ Actions recommandées pour HTTPS:"
    echo "   1. Vérifier la configuration Nginx (voir nginx.conf.example)"
    echo "   2. S'assurer que X-Forwarded-Proto est transmis"
    echo "   3. Redémarrer Nginx: sudo systemctl reload nginx"
else
    echo "ℹ️  En local HTTP:"
    echo "   → Les cookies ne sont pas sécurisés (normal)"
    echo "   → Devrait fonctionner sans configuration spéciale"
fi

echo ""
echo "📚 Pour plus d'aide:"
echo "   • Consultez: TROUBLESHOOTING-CSRF.md"
echo "   • Logs du serveur: pm2 logs (ou journalctl -u votre-service)"
echo ""
