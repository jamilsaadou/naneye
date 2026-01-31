"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const ruleSchema = z
  .object({
    taxId: z.string().min(1),
    commune: z.string().optional().nullable(),
    neighborhood: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    zone: z.string().optional().nullable(),
    active: z.boolean(),
  })
  .refine(
    (data) => Boolean(data.commune || data.neighborhood || data.category || data.zone),
    "Au moins un critère est requis."
  );

function normalizeRuleInput(raw: Record<string, string>) {
  return {
    taxId: raw.taxId ?? "",
    commune: raw.commune?.trim() ? raw.commune.trim() : null,
    neighborhood: raw.neighborhood?.trim() ? raw.neighborhood.trim() : null,
    category: raw.category?.trim() ? raw.category.trim() : null,
    zone: raw.zone?.trim() ? raw.zone.trim() : null,
    active: raw.active === "on",
  };
}

export async function createTaxRule(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = ruleSchema.safeParse(normalizeRuleInput(raw));

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.taxRule.create({
    data: parsed.data,
  });

  revalidatePath("/taxes/rules");
}

export async function updateTaxRule(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = ruleSchema.safeParse(normalizeRuleInput(raw));

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.taxRule.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath("/taxes/rules");
}

export async function toggleTaxRuleStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  await prisma.taxRule.update({
    where: { id },
    data: { active: active === "true" },
  });

  revalidatePath("/taxes/rules");
}
