"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCsrfToken } from "@/lib/csrf";

const categorySchema = z.object({
  label: z.string().min(2),
  code: z.string().min(1),
  sanitationAmount: z.string().min(1),
});

export async function createTaxpayerCategory(formData: FormData) {
  await assertCsrfToken(formData);
  const parsed = categorySchema.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
    sanitationAmount: String(formData.get("sanitationAmount") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.taxpayerCategory.create({
    data: {
      label: parsed.data.label,
      code: parsed.data.code,
      sanitationAmount: parsed.data.sanitationAmount,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/taxpayers/new");
}

export async function updateTaxpayerCategory(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const parsed = categorySchema.safeParse({
    label: String(formData.get("label") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
    sanitationAmount: String(formData.get("sanitationAmount") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.taxpayerCategory.update({
    where: { id },
    data: {
      label: parsed.data.label,
      code: parsed.data.code,
      sanitationAmount: parsed.data.sanitationAmount,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/taxpayers/new");
}

export async function deleteTaxpayerCategory(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const category = await prisma.taxpayerCategory.findUnique({
    where: { id },
    select: { id: true, label: true },
  });
  if (!category) {
    throw new Error("Categorie introuvable");
  }

  const taxpayerCount = await prisma.taxpayer.count({
    where: { category: category.label },
  });
  if (taxpayerCount > 0) {
    throw new Error("Suppression impossible: des contribuables utilisent cette categorie.");
  }

  await prisma.taxpayerCategory.delete({ where: { id } });

  revalidatePath("/admin/settings/categories");
  revalidatePath("/taxpayers/new");
}
