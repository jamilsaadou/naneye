const SESSION_COOKIE_NAME = "session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const SESSION_ROTATE_SECONDS = 60 * 60 * 2;
const SESSION_SECRET_FALLBACK = "dev-session-secret-change";
const MIN_SECRET_LENGTH = 32;
const IV_LENGTH = 12;

type SessionPayload = {
  id: string;
  role: string;
  iat: number;
  exp: number;
};

function getEnv(name: string) {
  if (typeof process === "undefined") return undefined;
  return process.env?.[name];
}

function isProd() {
  return getEnv("NODE_ENV") === "production";
}

function getSessionSecret() {
  const secret = getEnv("SESSION_SECRET") ?? SESSION_SECRET_FALLBACK;
  if (isProd() && (secret === SESSION_SECRET_FALLBACK || secret.length < MIN_SECRET_LENGTH)) {
    throw new Error("SESSION_SECRET manquant ou trop court en production.");
  }
  return secret;
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

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const base64 = normalized + pad;
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getAesKey() {
  const encoder = new TextEncoder();
  const secret = getSessionSecret();
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function getNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function isValidPayload(payload: SessionPayload) {
  if (!payload?.id || !payload?.role) return false;
  if (!payload.iat || !payload.exp) return false;
  return payload.exp > payload.iat;
}

export async function createSessionToken(payload: { id: string; role: string }) {
  const now = getNowSeconds();
  const session: SessionPayload = {
    id: payload.id,
    role: payload.role,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await getAesKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(session)),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return base64UrlEncode(combined);
}

export async function readSessionToken(token?: string | null) {
  if (!token) return null;
  try {
    const data = base64UrlDecode(token);
    if (data.length <= IV_LENGTH) return null;
    const iv = data.slice(0, IV_LENGTH);
    const ciphertext = data.slice(IV_LENGTH);
    const key = await getAesKey();
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    const decoded = JSON.parse(new TextDecoder().decode(plaintext)) as SessionPayload;
    if (!isValidPayload(decoded)) return null;
    const now = getNowSeconds();
    if (decoded.exp <= now) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function shouldRotateSession(session: SessionPayload) {
  const now = getNowSeconds();
  return session.exp - now <= SESSION_ROTATE_SECONDS;
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProd(),
    maxAge: SESSION_TTL_SECONDS,
  };
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
export type { SessionPayload };
