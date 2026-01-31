import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../lib/passwords";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed en production...\n");

  // Créer le Super Admin principal
  const superAdminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const superAdminPassword = process.env.ADMIN_PASSWORD || "ChangeMe@123";

  if (superAdminPassword === "ChangeMe@123") {
    console.warn("⚠️  ATTENTION: Utilisez des variables d'environnement pour définir le mot de passe!");
    console.warn("   Définissez ADMIN_EMAIL et ADMIN_PASSWORD dans votre .env\n");
  }

  const passwordHash = await hashPassword(superAdminPassword);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      name: "Super Administrateur",
      role: Role.SUPER_ADMIN,
      passwordHash,
      enabledModules: [
        "dashboard",
        "map",
        "taxpayers",
        "collections",
        "collectors",
        "payments",
        "reductions",
        "reports",
        "audit",
        "logs",
        "user-management",
        "global-calculation",
        "settings",
      ],
    },
    create: {
      email: superAdminEmail,
      name: "Super Administrateur",
      role: Role.SUPER_ADMIN,
      passwordHash,
      enabledModules: [
        "dashboard",
        "map",
        "taxpayers",
        "collections",
        "collectors",
        "payments",
        "reductions",
        "reports",
        "audit",
        "logs",
        "user-management",
        "global-calculation",
        "settings",
      ],
    },
  });

  console.log(`✓ Super Admin créé/mis à jour:`);
  console.log(`  Email: ${superAdmin.email}`);
  console.log(`  ID: ${superAdmin.id}`);
  console.log(`  Rôle: ${superAdmin.role}\n`);

  // Créer les paramètres de l'application si nécessaire
  const municipalityName = process.env.MUNICIPALITY_NAME || "Commune";

  const settings = await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      municipalityName,
    },
    create: {
      id: "main-settings",
      municipalityName,
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      receiptFooter: "Merci pour votre civisme fiscal.",
    },
  });

  console.log(`✓ Paramètres de l'application configurés`);
  console.log(`  Municipalité: ${settings.municipalityName}\n`);

  console.log("✅ Seed en production terminé avec succès!");
}

main()
  .catch((error) => {
    console.error("❌ Erreur lors du seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
