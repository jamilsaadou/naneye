const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_FORM_FIELD = "csrfToken";
const CSRF_TTL_SECONDS = 60 * 60 * 24;

function isProd() {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
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

export function getCsrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd(),
    maxAge: CSRF_TTL_SECONDS,
  };
}

export { CSRF_COOKIE_NAME, CSRF_FORM_FIELD, CSRF_HEADER_NAME };
