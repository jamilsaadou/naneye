#!/bin/bash

echo "🌐 Diagnostic Configuration Sous-Domaines"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
APP_DOMAIN=${1:-"app.example.com"}
API_DOMAIN=${2:-"api.example.com"}

if [ "$APP_DOMAIN" == "app.example.com" ]; then
    echo -e "${YELLOW}Usage:${NC} $0 app.votre-domaine.com api.votre-domaine.com"
    echo ""
    echo "Exemple:"
    echo "  $0 app.taxes.com api.taxes.com"
    echo ""
    exit 1
fi

echo -e "${BLUE}Domaines testés:${NC}"
echo "  Frontend: https://$APP_DOMAIN"
echo "  API:      https://$API_DOMAIN"
echo ""

# ═══════════════════════════════════════════════════════════════
# Test 1: Résolution DNS
# ═══════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════"
echo "📍 Test 1: Résolution DNS"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Frontend ($APP_DOMAIN):"
APP_IP=$(dig +short $APP_DOMAIN | head -n1)
if [ -n "$APP_IP" ]; then
    echo -e "  ${GREEN}✓${NC} Résolu vers: $APP_IP"
else
    echo -e "  ${RED}✗${NC} Impossible de résoudre le domaine"
    echo "     → Vérifiez votre configuration DNS"
fi

echo ""
echo "API ($API_DOMAIN):"
API_IP=$(dig +short $API_DOMAIN | head -n1)
if [ -n "$API_IP" ]; then
    echo -e "  ${GREEN}✓${NC} Résolu vers: $API_IP"
else
    echo -e "  ${RED}✗${NC} Impossible de résoudre le domaine"
    echo "     → Vérifiez votre configuration DNS"
fi

echo ""
if [ "$APP_IP" == "$API_IP" ] && [ -n "$APP_IP" ]; then
    echo -e "  ${GREEN}✓${NC} Les deux domaines pointent vers la même IP (correct)"
else
    echo -e "  ${YELLOW}⚠${NC}  Les domaines pointent vers des IPs différentes"
    echo "     → Pour cette architecture, ils devraient pointer vers la même IP"
fi

# ═══════════════════════════════════════════════════════════════
# Test 2: Accessibilité HTTPS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔒 Test 2: Accessibilité HTTPS"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Frontend (https://$APP_DOMAIN):"
APP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$APP_DOMAIN" 2>/dev/null)
if [ "$APP_STATUS" == "200" ] || [ "$APP_STATUS" == "301" ] || [ "$APP_STATUS" == "302" ]; then
    echo -e "  ${GREEN}✓${NC} Accessible (HTTP $APP_STATUS)"
else
    echo -e "  ${RED}✗${NC} Non accessible (HTTP $APP_STATUS)"
    echo "     → Vérifiez Nginx et les certificats SSL"
fi

echo ""
echo "API (https://$API_DOMAIN/auth/me):"
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$API_DOMAIN/auth/me" 2>/dev/null)
if [ "$API_STATUS" == "401" ]; then
    echo -e "  ${GREEN}✓${NC} Accessible (HTTP 401 - attendu sans authentification)"
elif [ "$API_STATUS" == "200" ]; then
    echo -e "  ${GREEN}✓${NC} Accessible (HTTP 200)"
else
    echo -e "  ${RED}✗${NC} Non accessible (HTTP $API_STATUS)"
    echo "     → Vérifiez Nginx et les certificats SSL"
fi

# ═══════════════════════════════════════════════════════════════
# Test 3: Certificats SSL
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔐 Test 3: Certificats SSL"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Frontend ($APP_DOMAIN):"
APP_CERT=$(echo | openssl s_client -servername $APP_DOMAIN -connect $APP_DOMAIN:443 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)
if [ -n "$APP_CERT" ]; then
    echo -e "  ${GREEN}✓${NC} Certificat SSL valide"
    echo "     $APP_CERT"
else
    echo -e "  ${RED}✗${NC} Certificat SSL invalide ou absent"
    echo "     → Exécutez: sudo certbot certonly --nginx -d $APP_DOMAIN"
fi

echo ""
echo "API ($API_DOMAIN):"
API_CERT=$(echo | openssl s_client -servername $API_DOMAIN -connect $API_DOMAIN:443 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)
if [ -n "$API_CERT" ]; then
    echo -e "  ${GREEN}✓${NC} Certificat SSL valide"
    echo "     $API_CERT"
else
    echo -e "  ${RED}✗${NC} Certificat SSL invalide ou absent"
    echo "     → Exécutez: sudo certbot certonly --nginx -d $API_DOMAIN"
fi

# ═══════════════════════════════════════════════════════════════
# Test 4: Headers CORS
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔄 Test 4: Configuration CORS"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Test OPTIONS (Preflight):"
CORS_RESPONSE=$(curl -s -X OPTIONS "https://$API_DOMAIN/auth/me" \
  -H "Origin: https://$APP_DOMAIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type,x-csrf-token" \
  -i 2>/dev/null)

if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    ALLOW_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "Access-Control-Allow-Origin" | head -n1)
    echo -e "  ${GREEN}✓${NC} Header CORS présent:"
    echo "     $ALLOW_ORIGIN"

    if echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Credentials"; then
        echo -e "  ${GREEN}✓${NC} Credentials autorisés (cookies cross-domain OK)"
    else
        echo -e "  ${YELLOW}⚠${NC}  Access-Control-Allow-Credentials manquant"
        echo "     → Les cookies ne fonctionneront pas entre domaines"
    fi
else
    echo -e "  ${RED}✗${NC} Headers CORS manquants"
    echo "     → Vérifiez la configuration Nginx et le middleware"
    echo "     → Ajoutez les headers CORS dans Nginx (voir docs/CONFIGURATION-SOUS-DOMAINES.md)"
fi

# ═══════════════════════════════════════════════════════════════
# Test 5: Cookie CSRF
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🍪 Test 5: Cookie CSRF"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Frontend (https://$APP_DOMAIN):"
COOKIES_DIR=$(mktemp -d)
curl -sS -c "$COOKIES_DIR/app_cookies.txt" "https://$APP_DOMAIN" > /dev/null 2>&1

if [ -f "$COOKIES_DIR/app_cookies.txt" ]; then
    CSRF_COOKIE=$(grep csrf_token "$COOKIES_DIR/app_cookies.txt" 2>/dev/null)

    if [ -n "$CSRF_COOKIE" ]; then
        echo -e "  ${GREEN}✓${NC} Cookie CSRF défini"

        if echo "$CSRF_COOKIE" | grep -qi "TRUE.*TRUE"; then
            echo -e "  ${GREEN}✓${NC} Cookie sécurisé (Secure flag)"
        else
            echo -e "  ${YELLOW}⚠${NC}  Cookie non sécurisé"
        fi

        # Vérifier SameSite
        CSRF_FULL=$(curl -sI "https://$APP_DOMAIN" | grep -i "set-cookie.*csrf_token")
        if echo "$CSRF_FULL" | grep -qi "SameSite=None"; then
            echo -e "  ${GREEN}✓${NC} SameSite=None (requis pour cross-domain)"
        else
            echo -e "  ${YELLOW}⚠${NC}  SameSite n'est pas 'None'"
            echo "     → Cookies cross-domain ne fonctionneront pas"
            echo "     → Modifiez lib/csrf-core.ts: sameSite: \"none\""
        fi
    else
        echo -e "  ${RED}✗${NC} Cookie CSRF non défini"
        echo "     → Vérifiez le middleware Next.js"
    fi
else
    echo -e "  ${RED}✗${NC} Impossible de récupérer les cookies"
fi

rm -rf "$COOKIES_DIR"

# ═══════════════════════════════════════════════════════════════
# Test 6: Routage API
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🔀 Test 6: Routage des requêtes API"
echo "═══════════════════════════════════════════════════════════"

echo ""
echo "Test endpoint API (/auth/me):"
API_RESPONSE=$(curl -s "https://$API_DOMAIN/auth/me" 2>/dev/null)

if echo "$API_RESPONSE" | grep -qi "unauthorized\|authentication"; then
    echo -e "  ${GREEN}✓${NC} Endpoint API répond correctement"
    echo "     → Réponse: 401 Unauthorized (attendu sans token)"
elif echo "$API_RESPONSE" | grep -qi "user\|email\|id"; then
    echo -e "  ${GREEN}✓${NC} Endpoint API répond correctement"
    echo "     → Réponse: Données utilisateur (déjà authentifié?)"
else
    echo -e "  ${RED}✗${NC} Endpoint API ne répond pas correctement"
    echo "     → Réponse: $API_RESPONSE"
    echo "     → Vérifiez la configuration Nginx (rewrite /api/)"
fi

echo ""
echo "Test que l'API n'est pas accessible depuis le domaine frontend:"
FRONTEND_API=$(curl -s -o /dev/null -w "%{http_code}" "https://$APP_DOMAIN/api/auth/me" 2>/dev/null)
if [ "$FRONTEND_API" == "404" ]; then
    echo -e "  ${GREEN}✓${NC} Routes /api/* bloquées sur le frontend (correct)"
elif [ "$FRONTEND_API" == "401" ]; then
    echo -e "  ${YELLOW}⚠${NC}  Routes /api/* accessibles depuis le frontend"
    echo "     → Pas critique mais non recommandé"
    echo "     → Vous pouvez bloquer dans Nginx (voir docs)"
else
    echo -e "  ${YELLOW}⚠${NC}  Statut inattendu: $FRONTEND_API"
fi

# ═══════════════════════════════════════════════════════════════
# Résumé
# ═══════════════════════════════════════════════════════════════
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 Résumé"
echo "═══════════════════════════════════════════════════════════"
echo ""

ALL_GOOD=true

if [ -z "$APP_IP" ] || [ -z "$API_IP" ]; then
    ALL_GOOD=false
    echo -e "${RED}✗ DNS${NC}"
    echo "  → Configurez les enregistrements DNS A pour pointer vers votre serveur"
    echo ""
fi

if [ "$APP_STATUS" != "200" ] && [ "$APP_STATUS" != "301" ] && [ "$APP_STATUS" != "302" ]; then
    ALL_GOOD=false
    echo -e "${RED}✗ Frontend inaccessible${NC}"
    echo "  → Vérifiez Nginx: sudo nginx -t && sudo systemctl status nginx"
    echo "  → Vérifiez les logs: sudo tail -f /var/log/nginx/app_error.log"
    echo ""
fi

if [ "$API_STATUS" != "401" ] && [ "$API_STATUS" != "200" ]; then
    ALL_GOOD=false
    echo -e "${RED}✗ API inaccessible${NC}"
    echo "  → Vérifiez Nginx: sudo nginx -t && sudo systemctl reload nginx"
    echo "  → Vérifiez les logs: sudo tail -f /var/log/nginx/api_error.log"
    echo ""
fi

if ! echo "$CORS_RESPONSE" | grep -qi "Access-Control-Allow-Origin"; then
    ALL_GOOD=false
    echo -e "${RED}✗ CORS non configuré${NC}"
    echo "  → Suivez le guide: docs/CONFIGURATION-SOUS-DOMAINES.md"
    echo "  → Vérifiez le middleware Next.js"
    echo "  → Vérifiez ALLOWED_ORIGINS dans .env"
    echo ""
fi

if [ "$ALL_GOOD" = true ]; then
    echo -e "${GREEN}✅ Configuration correcte!${NC}"
    echo ""
    echo "Votre application est prête:"
    echo "  • Frontend: https://$APP_DOMAIN"
    echo "  • API:      https://$API_DOMAIN"
    echo ""
    echo "Testez la connexion depuis le navigateur:"
    echo "  1. Ouvrez https://$APP_DOMAIN"
    echo "  2. Connectez-vous avec vos identifiants"
    echo "  3. Vérifiez qu'il n'y a pas d'erreurs CORS dans la console"
else
    echo -e "${YELLOW}⚠  Configuration incomplète${NC}"
    echo ""
    echo "Actions recommandées:"
    echo "  1. Corrigez les erreurs ci-dessus"
    echo "  2. Relancez ce script pour vérifier"
    echo "  3. Consultez: docs/CONFIGURATION-SOUS-DOMAINES.md"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📚 Ressources"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Documentation:"
echo "  • Guide complet: docs/CONFIGURATION-SOUS-DOMAINES.md"
echo "  • Dépannage CSRF: TROUBLESHOOTING-CSRF.md"
echo "  • Configuration Nginx: nginx.conf.example"
echo ""
echo "Commandes utiles:"
echo "  • Logs Nginx: sudo tail -f /var/log/nginx/{app,api}_error.log"
echo "  • Logs Next.js: pm2 logs taxes-app"
echo "  • Test Nginx: sudo nginx -t"
echo "  • Reload Nginx: sudo systemctl reload nginx"
echo ""
