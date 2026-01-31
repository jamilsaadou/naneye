import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "./lib/passwords";

const prisma = new PrismaClient();

async function testLogin() {
  console.log("=== Test de connexion ===\n");

  // Liste des utilisateurs à tester
  const testUsers = [
    { email: "me.jamilou@gmail.com", password: "Naneye@" },
    { email: "admin@taxes.local", password: "Admin@123" },
  ];

  for (const testUser of testUsers) {
    console.log(`Test pour: ${testUser.email}`);

    const user = await prisma.user.findUnique({
      where: { email: testUser.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      console.log(`❌ Utilisateur NON TROUVÉ\n`);
      continue;
    }

    console.log(`✓ Utilisateur trouvé: ${user.name} (${user.role})`);
    console.log(`Hash stocké: ${user.passwordHash.substring(0, 20)}...`);

    const verification = await verifyPassword(testUser.password, user.passwordHash);

    if (verification.ok) {
      console.log(`✓ Mot de passe VALIDE`);
      if (verification.needsRehash) {
        console.log(`  ⚠ Le hash nécessite une mise à jour`);
      }
    } else {
      console.log(`❌ Mot de passe INVALIDE`);
    }
    console.log("");
  }

  await prisma.$disconnect();
}

testLogin().catch(console.error);
