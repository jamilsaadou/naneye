"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertCsrfToken } from "@/lib/csrf";

const groupSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(values: FormDataEntryValue[]) {
  return values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseBoolean(value: FormDataEntryValue | undefined) {
  if (typeof value !== "string") return false;
  return value === "on" || value === "true";
}

async function resolveScopedContext() {
  const user = await getUserWithCommune();
  if (!user) throw new Error("Accès refusé");
  const scopedCommuneId = user.role === "SUPER_ADMIN" ? null : user.commune?.id ?? null;
  return {
    isSuperAdmin: user.role === "SUPER_ADMIN",
    scopedCommuneId,
  };
}

function canManageGroup(scopedCommuneId: string | null, group: { isGlobal: boolean; communes: Array<{ id: string }> }) {
  if (!scopedCommuneId) return true;
  if (group.isGlobal) return false;
  return group.communes.length === 1 && group.communes[0].id === scopedCommuneId;
}

async function resolveCommuneIds(communeIds: string[]) {
  if (communeIds.length === 0) return [];
  const communes = await prisma.commune.findMany({
    where: { id: { in: communeIds } },
    select: { id: true },
  });
  if (communes.length !== communeIds.length) {
    throw new Error("Commune invalide");
  }
  return communes.map((commune) => commune.id);
}

export async function createTaxpayerGroup(formData: FormData) {
  await assertCsrfToken(formData);
  const { isSuperAdmin, scopedCommuneId } = await resolveScopedContext();
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = groupSchema.safeParse({
    name: getString(raw.name),
    description: getString(raw.description) || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const isGlobal = isSuperAdmin ? parseBoolean(raw.isGlobal) : false;
  const rawCommuneIds = isSuperAdmin ? getStringArray(formData.getAll("communes")) : [];
  const communeIds = isSuperAdmin
    ? isGlobal
      ? []
      : await resolveCommuneIds(rawCommuneIds)
    : scopedCommuneId
      ? [scopedCommuneId]
      : [];

  if (!isGlobal && communeIds.length === 0) {
    throw new Error("Sélectionnez au moins une commune.");
  }

  const created = await prisma.taxpayerGroup.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isGlobal,
      ...(isGlobal ? {} : { communes: { connect: communeIds.map((id) => ({ id })) } }),
    },
    include: { communes: true },
  });

  await logAudit({
    action: "TAXPAYER_GROUP_CREATED",
    entityType: "SYSTEM",
    entityId: created.id,
    after: created,
  });

  revalidatePath("/taxpayers/groups");
  revalidatePath("/taxpayers");
  revalidatePath("/taxpayers/new");
  revalidatePath("/assessments");
  revalidatePath("/reports");
  revalidatePath("/collections/due");
  revalidatePath("/collections/partial");
  revalidatePath("/collections/paid");
  return { ok: true, message: "Groupe créé." };
}

export async function updateTaxpayerGroup(formData: FormData) {
  await assertCsrfToken(formData);
  const { isSuperAdmin, scopedCommuneId } = await resolveScopedContext();
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const id = getString(raw.id);
  if (!id) throw new Error("Identifiant manquant");

  const before = await prisma.taxpayerGroup.findUnique({ where: { id }, include: { communes: true } });
  if (!before) throw new Error("Groupe introuvable");
  if (!canManageGroup(scopedCommuneId, before)) {
    throw new Error("Accès refusé pour ce groupe");
  }

  const parsed = groupSchema.safeParse({
    name: getString(raw.name),
    description: getString(raw.description) || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const isGlobal = isSuperAdmin ? parseBoolean(raw.isGlobal) : false;
  const rawCommuneIds = isSuperAdmin ? getStringArray(formData.getAll("communes")) : [];
  const communeIds = isSuperAdmin
    ? isGlobal
      ? []
      : await resolveCommuneIds(rawCommuneIds)
    : scopedCommuneId
      ? [scopedCommuneId]
      : [];

  if (!isGlobal && communeIds.length === 0) {
    throw new Error("Sélectionnez au moins une commune.");
  }

  const updated = await prisma.taxpayerGroup.update({
    where: { id },
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      isGlobal,
      communes: { set: isGlobal ? [] : communeIds.map((communeId) => ({ id: communeId })) },
    },
    include: { communes: true },
  });

  await logAudit({
    action: "TAXPAYER_GROUP_UPDATED",
    entityType: "SYSTEM",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/taxpayers/groups");
  revalidatePath("/taxpayers");
  revalidatePath("/taxpayers/new");
  revalidatePath("/assessments");
  revalidatePath("/reports");
  revalidatePath("/collections/due");
  revalidatePath("/collections/partial");
  revalidatePath("/collections/paid");
  return { ok: true, message: "Groupe mis à jour." };
}

export async function deleteTaxpayerGroup(formData: FormData) {
  await assertCsrfToken(formData);
  const { scopedCommuneId } = await resolveScopedContext();
  const id = getString(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const group = await prisma.taxpayerGroup.findUnique({ where: { id }, include: { communes: true } });
  if (!group) throw new Error("Groupe introuvable");
  if (!canManageGroup(scopedCommuneId, group)) {
    throw new Error("Accès refusé pour ce groupe");
  }

  const count = await prisma.taxpayer.count({ where: { groupId: id } });
  if (count > 0) {
    throw new Error("Ce groupe contient des contribuables.");
  }

  await prisma.taxpayerGroup.delete({ where: { id } });

  await logAudit({
    action: "TAXPAYER_GROUP_DELETED",
    entityType: "SYSTEM",
    entityId: id,
    after: {
      name: group.name,
      isGlobal: group.isGlobal,
      communes: group.communes.map((commune) => commune.name),
    },
  });

  revalidatePath("/taxpayers/groups");
  revalidatePath("/taxpayers");
  revalidatePath("/taxpayers/new");
  revalidatePath("/assessments");
  revalidatePath("/reports");
  revalidatePath("/collections/due");
  revalidatePath("/collections/partial");
  revalidatePath("/collections/paid");
  return { ok: true, message: "Groupe supprimé." };
}
