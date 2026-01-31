"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const categorySchema = z.object({
  label: z.string().min(2),
  code: z.string().min(1),
  sanitationAmount: z.string().min(1),
});

export async function createTaxpayerCategory(formData: FormData) {
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
