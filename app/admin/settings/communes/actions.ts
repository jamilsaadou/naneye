"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const communeSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1),
});

export async function createCommune(formData: FormData) {
  const parsed = communeSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.commune.create({
    data: { name: parsed.data.name, code: parsed.data.code },
  });

  revalidatePath("/admin/settings/communes");
  revalidatePath("/taxpayers/new");
}

export async function updateCommune(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const parsed = communeSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    code: String(formData.get("code") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.commune.update({
    where: { id },
    data: { name: parsed.data.name, code: parsed.data.code },
  });

  revalidatePath("/admin/settings/communes");
  revalidatePath("/taxpayers/new");
}
