"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const neighborhoodSchema = z.object({
  name: z.string().min(2),
  communeId: z.string().min(1),
});

export async function createNeighborhood(formData: FormData) {
  const parsed = neighborhoodSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    communeId: String(formData.get("communeId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.neighborhood.create({
    data: {
      name: parsed.data.name,
      communeId: parsed.data.communeId,
    },
  });

  revalidatePath("/admin/settings/neighborhoods");
  revalidatePath("/taxpayers/new");
}

export async function updateNeighborhood(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const parsed = neighborhoodSchema.safeParse({
    name: String(formData.get("name") ?? "").trim(),
    communeId: String(formData.get("communeId") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  await prisma.neighborhood.update({
    where: { id },
    data: {
      name: parsed.data.name,
      communeId: parsed.data.communeId,
    },
  });

  revalidatePath("/admin/settings/neighborhoods");
  revalidatePath("/taxpayers/new");
}
