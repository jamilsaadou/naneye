"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCsrfToken } from "@/lib/csrf";

const rateSchema = z
  .string()
  .min(1)
  .regex(/^\d+(\.\d{1,4})?$/, "Taux invalide");

const taxSchema = z.object({
  code: z.string().min(2),
  label: z.string().min(2),
  rate: rateSchema,
  active: z.boolean(),
});

export async function createTax(formData: FormData) {
  await assertCsrfToken(formData);
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = taxSchema.safeParse({
    code: raw.code ?? "",
    label: raw.label ?? "",
    rate: raw.rate ?? "",
    active: raw.active === "on",
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const existing = await prisma.tax.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    throw new Error("Code taxe déjà utilisé");
  }

  await prisma.tax.create({
    data: {
      code: parsed.data.code,
      label: parsed.data.label,
      rate: parsed.data.rate,
      active: parsed.data.active,
    },
  });

  revalidatePath("/taxes");
}

export async function updateTax(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = taxSchema.safeParse({
    code: raw.code ?? "",
    label: raw.label ?? "",
    rate: raw.rate ?? "",
    active: raw.active === "on",
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const existing = await prisma.tax.findFirst({
    where: { code: parsed.data.code, NOT: { id } },
  });
  if (existing) {
    throw new Error("Code taxe déjà utilisé");
  }

  await prisma.tax.update({
    where: { id },
    data: {
      code: parsed.data.code,
      label: parsed.data.label,
      rate: parsed.data.rate,
      active: parsed.data.active,
    },
  });

  revalidatePath("/taxes");
}

export async function toggleTaxStatus(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  await prisma.tax.update({
    where: { id },
    data: { active: active === "true" },
  });

  revalidatePath("/taxes");
}

export async function deleteTax(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const tax = await prisma.tax.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!tax) {
    throw new Error("Taxe introuvable");
  }

  const [measureCount, ruleCount, lineCount] = await Promise.all([
    prisma.taxpayerMeasure.count({ where: { taxId: id } }),
    prisma.taxRule.count({ where: { taxId: id } }),
    prisma.noticeLine.count({ where: { taxId: id } }),
  ]);

  if (measureCount > 0 || ruleCount > 0 || lineCount > 0) {
    throw new Error("Suppression impossible: cette taxe est utilisée.");
  }

  await prisma.tax.delete({ where: { id } });

  revalidatePath("/taxes");
  revalidatePath("/taxes/rules");
}
