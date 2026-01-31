import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm" as const;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const DEFAULT_SECRET = "dev-assessment-secret-change";
const MIN_SECRET_LENGTH = 32;

function isProd() {
  return process.env.NODE_ENV === "production";
}

function getSecret() {
  const secret = process.env.ASSESSMENT_LINK_SECRET ?? DEFAULT_SECRET;
  if (isProd() && (secret === DEFAULT_SECRET || secret.length < MIN_SECRET_LENGTH)) {
    throw new Error("ASSESSMENT_LINK_SECRET manquant ou trop court en production.");
  }
  return secret;
}

function getKey() {
  return createHash("sha256").update(getSecret()).digest();
}

function toBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

export function encryptAssessmentToken(payload: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return toBase64Url(Buffer.concat([iv, tag, ciphertext]));
}

export function decryptAssessmentToken(token: string) {
  try {
    const data = fromBase64Url(token);
    if (data.length <= IV_LENGTH + TAG_LENGTH) return null;
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString("utf8");
  } catch {
    return null;
  }
}
