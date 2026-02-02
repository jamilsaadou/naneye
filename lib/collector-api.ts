import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, isEncrypted } from "@/lib/encryption";

export type CollectorJwtPayload = {
  iss?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  txnId?: string;
  [key: string]: unknown;
};

function base64UrlDecode(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf-8");
}

function base64UrlEncode(input: Buffer) {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function signCollectorJwt(payload: CollectorJwtPayload, secret: string) {
  const header = { alg: "HS256", typ: "JWT" };
  const headerPart = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadPart = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const data = `${headerPart}.${payloadPart}`;
  const signature = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  return `${data}.${signature}`;
}

function verifyJwtHs256(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT invalide");
  }

  const [headerPart, payloadPart, signaturePart] = parts;
  const header = JSON.parse(base64UrlDecode(headerPart)) as { alg?: string };
  if (header.alg !== "HS256") {
    throw new Error("JWT algorithme non supporte");
  }

  const data = `${headerPart}.${payloadPart}`;
  const expected = base64UrlEncode(createHmac("sha256", secret).update(data).digest());
  const valid = timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expected));
  if (!valid) {
    throw new Error("Signature JWT invalide");
  }

  const payload = JSON.parse(base64UrlDecode(payloadPart)) as CollectorJwtPayload;
  const now = Math.floor(Date.now() / 1000);

  // Vérifier que le token n'est pas émis dans le futur (tolérance de 60s pour décalage d'horloge)
  if (payload.iat && payload.iat > now + 60) {
    throw new Error("JWT invalide");
  }

  // Vérifier la date de début de validité (nbf = not before)
  if (payload.nbf && payload.nbf > now) {
    throw new Error("JWT pas encore valide");
  }

  if (payload.exp && payload.exp < now) {
    throw new Error("JWT expire");
  }

  return payload;
}

export async function verifyCollectorRequest(token: string | null, requestTxnId?: string | null) {
  if (!token) {
    throw new Error("JWT manquant");
  }

  const raw = token.startsWith("Bearer ") ? token.slice(7) : token;
  const decoded = JSON.parse(base64UrlDecode(raw.split(".")[1] ?? "")) as CollectorJwtPayload;
  const issuer = decoded.iss;
  if (!issuer) {
    throw new Error("JWT issuer manquant");
  }

  const collector = await prisma.collector.findUnique({ where: { code: issuer } });
  if (!collector || collector.status !== "ACTIVE") {
    throw new Error("Collecteur non autorise");
  }
  if (!collector.jwtSecret) {
    throw new Error("JWT secret manquant pour ce collecteur");
  }

  // Déchiffrer le secret s'il est chiffré
  const secret = isEncrypted(collector.jwtSecret)
    ? decryptSecret(collector.jwtSecret)
    : collector.jwtSecret;

  const payload = verifyJwtHs256(raw, secret);
  if (requestTxnId && payload.txnId && payload.txnId !== requestTxnId) {
    throw new Error("txnId non conforme");
  }

  return { payload, collector };
}
