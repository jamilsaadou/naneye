import {
  Prisma,
  PrismaClient,
  CollectorStatus,
  NoticeStatus,
  Role,
  TaxpayerStatus,
} from "@prisma/client";
import { createHash } from "crypto";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = "admin@taxes.local";
  const adminPassword = createHash("sha256").update("Admin@123").digest("hex");
  const superAdminEmail = "me.jamilou@gmail.com";
  const superAdminPassword = createHash("sha256").update("Naneye@").digest("hex");

  await prisma.user.upsert({
    where: { email: superAdminEmail },
    update: {
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      passwordHash: superAdminPassword,
      enabledModules: ["dashboard", "map", "taxpayers", "collections", "collectors", "payments", "reductions", "reports", "audit", "logs", "settings"],
    },
    create: {
      email: superAdminEmail,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      passwordHash: superAdminPassword,
      enabledModules: ["dashboard", "map", "taxpayers", "collections", "collectors", "payments", "reductions", "reports", "audit", "logs", "settings"],
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Admin", role: Role.SUPER_ADMIN, passwordHash: adminPassword },
    create: { email: adminEmail, name: "Admin", role: Role.SUPER_ADMIN, passwordHash: adminPassword },
  });

  const category = await prisma.taxpayerCategory.upsert({
    where: { label: "Commerce" },
    update: { sanitationAmount: "15000.00", code: "10" },
    create: { label: "Commerce", code: "10", sanitationAmount: "15000.00" },
  });

  const commune = await prisma.commune.upsert({
    where: { name: "Commune 1" },
    update: { code: "1" },
    create: { name: "Commune 1", code: "1" },
  });

  const neighborhood = await prisma.neighborhood.upsert({
    where: { communeId_name: { communeId: commune.id, name: "Plateau" } },
    update: {},
    create: { name: "Plateau", communeId: commune.id },
  });

  const taxpayer = await prisma.taxpayer.upsert({
    where: { id: "seed-taxpayer-1" },
    update: {
      name: "Société Niger",
      address: "Niamey",
      category: category.label,
      neighborhood: neighborhood.name,
      commune: commune.name,
      phone: "+227 90 00 00 00",
    },
    create: {
      id: "seed-taxpayer-1",
      name: "Société Niger",
      address: "Niamey",
      email: "contact@niger.example",
      category: category.label,
      neighborhood: neighborhood.name,
      commune: commune.name,
      phone: "+227 90 00 00 00",
      status: TaxpayerStatus.ACTIVE,
    },
  });

  const taxMarket = await prisma.tax.upsert({
    where: { code: "TX-MARKET" },
    update: { label: "Taxe Marché", rate: "0.0500", active: true },
    create: { code: "TX-MARKET", label: "Taxe Marché", rate: "0.0500", active: true },
  });

  const taxService = await prisma.tax.upsert({
    where: { code: "TX-SERVICE" },
    update: { label: "Taxe Service", rate: "0.0200", active: true },
    create: { code: "TX-SERVICE", label: "Taxe Service", rate: "0.0200", active: true },
  });

  await prisma.taxRule.upsert({
    where: { id: "seed-rule-market" },
    update: {
      taxId: taxMarket.id,
      commune: "Commune 1",
      neighborhood: "Plateau",
      category: "Commerce",
      active: true,
    },
    create: {
      id: "seed-rule-market",
      taxId: taxMarket.id,
      commune: "Commune 1",
      neighborhood: "Plateau",
      category: "Commerce",
      active: true,
    },
  });

  const notice = await prisma.notice.upsert({
    where: { number: "AV-2026-0001" },
    update: {},
    create: {
      number: "AV-2026-0001",
      taxpayerId: taxpayer.id,
      year: 2026,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-12-31"),
      totalAmount: "70000.00",
      amountPaid: "0.00",
      status: NoticeStatus.UNPAID,
      lines: {
        create: [
          {
            taxId: taxMarket.id,
            taxCode: taxMarket.code,
            taxLabel: taxMarket.label,
            taxRate: taxMarket.rate,
            baseAmount: "1000000.00",
            amount: "50000.00",
          },
          {
            taxId: taxService.id,
            taxCode: taxService.code,
            taxLabel: taxService.label,
            taxRate: taxService.rate,
            baseAmount: "1000000.00",
            amount: "20000.00",
          },
        ],
      },
    },
  });

  const collector = await prisma.collector.upsert({
    where: { code: "COL-001" },
    update: {
      name: "Amina Harouna",
      phone: "+227 92 00 00 00",
      status: CollectorStatus.ACTIVE,
    },
    create: {
      code: "COL-001",
      name: "Amina Harouna",
      phone: "+227 92 00 00 00",
      email: "amina.harouna@taxes.local",
      status: CollectorStatus.ACTIVE,
    },
  });

  await prisma.payment.create({
    data: {
      noticeId: notice.id,
      collectorId: collector.id,
      amount: "15000.00",
      method: "CASH",
      createdById: admin.id,
    },
  });

  await prisma.notice.update({
    where: { id: notice.id },
    data: {
      amountPaid: "15000.00",
      status: NoticeStatus.PARTIAL,
      locked: true,
      lockedAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      action: "SEED",
      entityType: "Notice",
      entityId: notice.id,
      before: Prisma.JsonNull,
      after: { message: "Initial notice seeded" },
    },
  });

  await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      municipalityName: "Commune 1",
      municipalityLogo: null,
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      receiptFooter: "Merci pour votre civisme fiscal.",
      assessmentHeader: null,
      assessmentFooter: null,
    },
    create: {
      id: "main-settings",
      municipalityName: "Commune 1",
      municipalityLogo: null,
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      receiptFooter: "Merci pour votre civisme fiscal.",
      assessmentHeader: null,
      assessmentFooter: null,
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
