import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY non definie dans les variables d'environnement");
  }
  // Dériver une clé de 32 bytes à partir de la clé fournie
  return scryptSync(key, "collector-secret-salt", 32);
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (tout en hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(":");

  if (parts.length !== 3) {
    throw new Error("Format de secret chiffre invalide");
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export function isEncrypted(value: string): boolean {
  // Un secret chiffré a le format iv:authTag:encrypted (3 parties en hex)
  const parts = value.split(":");
  if (parts.length !== 3) return false;

  // Vérifier que chaque partie est du hex valide
  const hexRegex = /^[0-9a-f]+$/i;
  return parts.every((part) => hexRegex.test(part));
}
