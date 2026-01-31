import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const SALUBRITE_CODE = "SALUBRITE";
const SALUBRITE_LABEL = "Taxe de salubrite";

function normalizeCommuneCode(code: string) {
  const trimmed = code.trim().toUpperCase();
  return trimmed.startsWith("C") ? trimmed.slice(1) : trimmed;
}

function buildNoticeNumber(communeCode: string, year: number, sequence: string) {
  const communePart = normalizeCommuneCode(communeCode);
  const yearPart = String(year).slice(-2);
  return `T${communePart}-${yearPart}-${sequence}`;
}

function buildTaxpayerCode(categoryCode: string, communeCode: string, sequence: string) {
  const communePart = normalizeCommuneCode(communeCode);
  const categoryPart = categoryCode.trim();
  return `${categoryPart}-${`C${communePart}`}-${sequence}`;
}

function nextSequence(current?: string) {
  const value = current ? Number.parseInt(current, 10) : 0;
  const next = Number.isNaN(value) ? 1 : value + 1;
  return String(next).padStart(5, "0");
}

export async function calculateNoticeForTaxpayer(taxpayerId: string, year = new Date().getFullYear()) {
  const taxpayer = await prisma.taxpayer.findUnique({
    where: { id: taxpayerId },
    include: { measures: true },
  });

  if (!taxpayer) {
    throw new Error("Contribuable introuvable");
  }
  if (taxpayer.status === "EN_ATTENTE") {
    throw new Error("Contribuable en attente. Veuillez l'approuver.");
  }

  const [taxes, category, commune] = await Promise.all([
    prisma.tax.findMany({ where: { active: true } }),
    prisma.taxpayerCategory.findUnique({ where: { label: taxpayer.category ?? "" } }),
    prisma.commune.findUnique({ where: { name: taxpayer.commune } }),
  ]);

  const measures = new Map(taxpayer.measures.map((measure) => [measure.taxId, measure.quantity]));
  const lines: Array<{
    taxId: string | null;
    taxCode: string;
    taxLabel: string;
    taxRate: Prisma.Decimal;
    baseAmount: Prisma.Decimal;
    amount: Prisma.Decimal;
  }> = [];

  let totalAmount = new Prisma.Decimal(0);

  for (const tax of taxes) {
    if (tax.code.toUpperCase() === SALUBRITE_CODE) continue;

    const quantity = measures.get(tax.id) ?? new Prisma.Decimal(0);
    if (quantity.lte(0)) continue;

    const amount = tax.rate.mul(quantity);
    totalAmount = totalAmount.add(amount);

    lines.push({
      taxId: tax.id,
      taxCode: tax.code,
      taxLabel: tax.label,
      taxRate: tax.rate,
      baseAmount: quantity,
      amount,
    });
  }

  if (!category) {
    throw new Error(`Categorie introuvable pour ${taxpayer.name}.`);
  }
  if (!commune) {
    throw new Error(`Commune introuvable pour ${taxpayer.name}.`);
  }

  const sanitationAmount = category.sanitationAmount ?? new Prisma.Decimal(0);
  if (sanitationAmount.gt(0)) {
    totalAmount = totalAmount.add(sanitationAmount);
    lines.push({
      taxId: null,
      taxCode: SALUBRITE_CODE,
      taxLabel: SALUBRITE_LABEL,
      taxRate: sanitationAmount,
      baseAmount: new Prisma.Decimal(1),
      amount: sanitationAmount,
    });
  }

  const periodStart = new Date(year, 0, 1);
  const periodEnd = new Date(year, 11, 31);

  if (!category.code) {
    throw new Error(`Code categorie manquant (${category.label}).`);
  }
  if (!commune.code) {
    throw new Error(`Code commune manquant (${commune.name}).`);
  }

  let taxpayerCode = taxpayer.code;
  if (!taxpayerCode) {
    const taxpayerPrefix = `${category.code}-C${normalizeCommuneCode(commune.code)}-`;
    const latestTaxpayer = await prisma.taxpayer.findFirst({
      where: { code: { startsWith: taxpayerPrefix } },
      orderBy: { code: "desc" },
    });
    const lastSeq = latestTaxpayer?.code?.slice(taxpayerPrefix.length);
    taxpayerCode = buildTaxpayerCode(category.code, commune.code, nextSequence(lastSeq));
    await prisma.taxpayer.update({
      where: { id: taxpayer.id },
      data: { code: taxpayerCode },
    });
  }

  const existingNotice = await prisma.notice.findFirst({
    where: {
      taxpayerId: taxpayer.id,
      year,
    },
  });

  if (existingNotice) {
    return existingNotice;
  }

  const noticePrefix = `T${normalizeCommuneCode(commune.code)}-${String(year).slice(-2)}-`;
  const latestNotice = await prisma.notice.findFirst({
    where: { number: { startsWith: noticePrefix } },
    orderBy: { number: "desc" },
  });
  const lastNoticeSeq = latestNotice?.number?.slice(noticePrefix.length);
  const noticeNumber = buildNoticeNumber(commune.code, year, nextSequence(lastNoticeSeq));

  return prisma.notice.create({
    data: {
      number: noticeNumber,
      taxpayerId: taxpayer.id,
      year,
      periodStart,
      periodEnd,
      totalAmount,
      amountPaid: new Prisma.Decimal(0),
      status: "UNPAID",
      lines: {
        create: lines.map((line) => ({
          taxId: line.taxId ?? undefined,
          taxCode: line.taxCode,
          taxLabel: line.taxLabel,
          taxRate: line.taxRate,
          baseAmount: line.baseAmount,
          amount: line.amount,
        })),
      },
    },
  });
}

export async function calculateNoticesForAllTaxpayers(year = new Date().getFullYear()) {
  const taxpayers = await prisma.taxpayer.findMany({
    select: { id: true },
    where: { status: "ACTIVE" },
  });
  for (const taxpayer of taxpayers) {
    await calculateNoticeForTaxpayer(taxpayer.id, year);
  }
}
