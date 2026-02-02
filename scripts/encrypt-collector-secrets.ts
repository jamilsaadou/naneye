/**
 * Script de migration pour chiffrer les secrets des collecteurs existants.
 *
 * Usage:
 *   npx tsx scripts/encrypt-collector-secrets.ts
 *
 * IMPORTANT: Assurez-vous que ENCRYPTION_KEY est défini dans .env avant d'exécuter ce script.
 */

import { PrismaClient } from "@prisma/client";
import { encryptSecret, isEncrypted } from "../lib/encryption";

const prisma = new PrismaClient();

async function main() {
  console.log("Recherche des collecteurs avec des secrets non chiffrés...\n");

  const collectors = await prisma.collector.findMany({
    where: { jwtSecret: { not: null } },
    select: { id: true, code: true, jwtSecret: true },
  });

  let migrated = 0;
  let skipped = 0;

  for (const collector of collectors) {
    if (!collector.jwtSecret) {
      skipped++;
      continue;
    }

    if (isEncrypted(collector.jwtSecret)) {
      console.log(`[SKIP] ${collector.code} - secret déjà chiffré`);
      skipped++;
      continue;
    }

    const encrypted = encryptSecret(collector.jwtSecret);
    await prisma.collector.update({
      where: { id: collector.id },
      data: { jwtSecret: encrypted },
    });

    console.log(`[OK] ${collector.code} - secret chiffré`);
    migrated++;
  }

  console.log(`\nTerminé: ${migrated} chiffré(s), ${skipped} ignoré(s)`);
}

main()
  .catch((error) => {
    console.error("Erreur:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
