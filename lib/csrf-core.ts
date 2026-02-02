const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_FORM_FIELD = "csrfToken";
const CSRF_TTL_SECONDS = 60 * 60 * 24;

function isProd() {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

/**
 * Détecte si on doit utiliser des cookies sécurisés (Secure flag)
 * Détection dynamique basée sur le header X-Forwarded-Proto
 */
function isSecureContext(headers?: Headers): boolean {
  // En développement, jamais de cookies sécurisés
  if (!isProd()) return false;

  // ⭐ DÉTECTION DYNAMIQUE via les headers (RECOMMANDÉ)
  // Si on a les headers, vérifier le protocole réel via X-Forwarded-Proto
  // (défini par Nginx/Apache en cas de reverse proxy)
  if (headers) {
    const forwardedProto = headers.get('x-forwarded-proto');
    if (forwardedProto) {
      const isHttps = forwardedProto === 'https';
      if (isProd() && !isHttps) {
        console.warn(`⚠️  CSRF: Connexion non-HTTPS en production (X-Forwarded-Proto: ${forwardedProto})`);
      }
      return isHttps;
    }
  }

  // Fallback: vérifier la variable d'environnement (pour compatibilité/debugging)
  if (process.env.FORCE_SECURE_COOKIES === "false") {
    console.warn("⚠️  CSRF: Cookies sécurisés désactivés (FORCE_SECURE_COOKIES=false)");
    return false;
  }

  // Par défaut en production sans headers: utiliser des cookies sécurisés
  return isProd();
}

function base64UrlEncode(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function generateCsrfToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return base64UrlEncode(bytes);
}

/**
 * Options pour le cookie CSRF
 * @param headers - Headers de la requête (pour détection dynamique HTTPS)
 */
export function getCsrfCookieOptions(headers?: Headers) {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: isSecureContext(headers),
    maxAge: CSRF_TTL_SECONDS,
  };
}

export { CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME };
