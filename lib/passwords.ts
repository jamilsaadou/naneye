import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";

const BCRYPT_ROUNDS = 12;
const LEGACY_SHA_REGEX = /^[a-f0-9]{64}$/i;

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("$2a$") || storedHash.startsWith("$2b$") || storedHash.startsWith("$2y$")) {
    const ok = await bcrypt.compare(password, storedHash);
    const rounds = bcrypt.getRounds(storedHash);
    return { ok, needsRehash: ok && rounds < BCRYPT_ROUNDS };
  }

  if (LEGACY_SHA_REGEX.test(storedHash)) {
    const legacyHash = createHash("sha256").update(password).digest("hex");
    const ok = safeEqual(legacyHash, storedHash);
    return { ok, needsRehash: ok };
  }

  return { ok: false, needsRehash: false };
}
