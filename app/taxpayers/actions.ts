"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateNoticeForTaxpayer } from "@/lib/tax-calculation";
import { logAudit } from "@/lib/audit";
import { getSession, getUserWithCommune } from "@/lib/auth";
import { assertCsrfToken } from "@/lib/csrf";
import { storeUpload, UploadPresets } from "@/lib/uploads";

const statusSchema = z.enum(["EN_ATTENTE", "ACTIVE", "ARCHIVED"]);

const taxpayerSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  neighborhood: z.string().min(2),
  commune: z.string().min(2),
  status: statusSchema.optional(),
  groupId: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().min(6),
  email: z.string().email().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value : "";
}

async function getScopedCommuneName() {
  const user = await getUserWithCommune();
  if (!user || user.role === "SUPER_ADMIN") return null;
  return user.commune?.name ?? null;
}

async function validateGroupAssignment(groupId: string | null, commune: string, scopedCommune: string | null) {
  if (!groupId) return null;
  const group = await prisma.taxpayerGroup.findUnique({
    where: { id: groupId },
    include: { communes: { select: { name: true } } },
  });
  if (!group) {
    throw new Error("Groupe introuvable");
  }
  const hasScopedAccess =
    !scopedCommune || group.isGlobal || group.communes.some((item) => item.name === scopedCommune);
  if (!hasScopedAccess) {
    throw new Error("Accès refusé pour ce groupe");
  }
  const matchesCommune = group.isGlobal || group.communes.some((item) => item.name === commune);
  if (!matchesCommune) {
    throw new Error("Le groupe ne correspond pas à la commune sélectionnée");
  }
  return group;
}

async function storePhoto(file: File) {
  return storeUpload(file, UploadPresets.photo);
}

export async function createTaxpayer(formData: FormData) {
  await assertCsrfToken(formData);
  const scopedCommune = await getScopedCommuneName();
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = taxpayerSchema.safeParse({
    name: getString(raw.name),
    category: getString(raw.category),
    neighborhood: getString(raw.neighborhood),
    commune: scopedCommune ?? getString(raw.commune),
    address: getString(raw.address) || null,
    phone: getString(raw.phone),
    email: getString(raw.email) || null,
    status: getString(raw.status) || "EN_ATTENTE",
    groupId: getString(raw.groupId) || null,
    photoUrl: getString(raw.photoUrl) || null,
    comment: getString(raw.comment) || null,
    latitude: getString(raw.latitude) || null,
    longitude: getString(raw.longitude) || null,
    startedAt: getString(raw.startedAt) || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  if (scopedCommune && parsed.data.commune !== scopedCommune) {
    throw new Error("Accès refusé pour cette commune");
  }

  await validateGroupAssignment(parsed.data.groupId ?? null, parsed.data.commune, scopedCommune);

  let photoUrl = parsed.data.photoUrl;
  const photoFile = formData.get("photoFile");
  if (photoFile instanceof File && photoFile.size > 0) {
    photoUrl = await storePhoto(photoFile);
  }

  const created = await prisma.taxpayer.create({
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      neighborhood: parsed.data.neighborhood,
      commune: parsed.data.commune,
      status: parsed.data.status ?? "EN_ATTENTE",
      groupId: parsed.data.groupId ?? null,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      photoUrl,
      comment: parsed.data.comment,
      latitude: parsed.data.latitude || null,
      longitude: parsed.data.longitude || null,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
    },
  });

  const files = formData.getAll("photoFiles").filter((entry): entry is File => entry instanceof File);
  const photoUrls = await Promise.all(
    files.filter((file) => file.size > 0).map((file) => storePhoto(file)),
  );
  if (photoUrl) {
    photoUrls.push(photoUrl);
  }
  if (photoUrls.length > 0) {
    await prisma.taxpayerPhoto.createMany({
      data: photoUrls.map((url) => ({ taxpayerId: created.id, url })),
    });
  }

  await logAudit({
    action: "TAXPAYER_CREATED",
    entityType: "TAXPAYER",
    entityId: created.id,
    after: created,
  });

  const measures = Object.entries(raw)
    .filter(([key]) => key.startsWith("measure_"))
    .map(([key, value]) => ({
      taxId: key.replace("measure_", ""),
      quantity: value,
    }))
    .filter((entry) => entry.quantity && Number(entry.quantity) > 0);

  if (measures.length > 0) {
    await prisma.taxpayerMeasure.createMany({
      data: measures.map((entry) => ({
        taxpayerId: created.id,
        taxId: entry.taxId,
        quantity: Number(entry.quantity),
      })),
    });
  }

  revalidatePath("/taxpayers");
}

export async function updateTaxpayer(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const scopedCommune = await getScopedCommuneName();
  const before = await prisma.taxpayer.findUnique({ where: { id } });
  if (scopedCommune && before?.commune !== scopedCommune) {
    throw new Error("Accès refusé pour cette commune");
  }

  const parsed = taxpayerSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    category: String(formData.get("category") ?? ""),
    neighborhood: String(formData.get("neighborhood") ?? ""),
    commune: scopedCommune ?? String(formData.get("commune") ?? ""),
    status: formData.get("status") ? String(formData.get("status")) : "EN_ATTENTE",
    groupId: formData.get("groupId") ? String(formData.get("groupId")) : null,
    address: formData.get("address") || null,
    phone: String(formData.get("phone") ?? ""),
    email: formData.get("email") || null,
    photoUrl: formData.get("photoUrl") || null,
    comment: formData.get("comment") || null,
    latitude: formData.get("latitude") || null,
    longitude: formData.get("longitude") || null,
    startedAt: formData.get("startedAt") || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }
  if (scopedCommune && parsed.data.commune !== scopedCommune) {
    throw new Error("Accès refusé pour cette commune");
  }

  await validateGroupAssignment(parsed.data.groupId ?? null, parsed.data.commune, scopedCommune);

  let photoUrl = parsed.data.photoUrl;
  const files = formData.getAll("photoFiles").filter((entry): entry is File => entry instanceof File);
  const photoUrls = await Promise.all(
    files.filter((file) => file.size > 0).map((file) => storePhoto(file)),
  );
  if (photoUrl) {
    photoUrls.push(photoUrl);
  }

  const updated = await prisma.taxpayer.update({
    where: { id },
    data: {
      name: parsed.data.name,
      category: parsed.data.category,
      neighborhood: parsed.data.neighborhood,
      commune: parsed.data.commune,
      status: parsed.data.status ?? "EN_ATTENTE",
      groupId: parsed.data.groupId ?? null,
      address: parsed.data.address,
      phone: parsed.data.phone,
      email: parsed.data.email,
      photoUrl,
      comment: parsed.data.comment,
      latitude: parsed.data.latitude || null,
      longitude: parsed.data.longitude || null,
      startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
    },
  });

  if (photoUrls.length > 0) {
    await prisma.taxpayerPhoto.createMany({
      data: photoUrls.map((url) => ({ taxpayerId: id, url })),
    });
  }

  await logAudit({
    action: "TAXPAYER_UPDATED",
    entityType: "TAXPAYER",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/taxpayers");
}

export async function archiveTaxpayer(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const before = await prisma.taxpayer.findUnique({ where: { id } });

  const updated = await prisma.taxpayer.update({
    where: { id },
    data: { status: "ARCHIVED" },
  });

  await logAudit({
    action: "TAXPAYER_ARCHIVED",
    entityType: "TAXPAYER",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/taxpayers");
}

export async function approveTaxpayer(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const scopedCommune = await getScopedCommuneName();
  const before = await prisma.taxpayer.findUnique({ where: { id } });
  if (scopedCommune && before?.commune !== scopedCommune) {
    throw new Error("Accès refusé pour cette commune");
  }

  const updated = await prisma.taxpayer.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  await logAudit({
    action: "TAXPAYER_APPROVED",
    entityType: "TAXPAYER",
    entityId: id,
    before,
    after: updated,
  });

  revalidatePath("/taxpayers");
}

export async function deleteNoticeByYear(formData: FormData) {
  await assertCsrfToken(formData);
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Accès refusé");
  }

  const taxpayerId = String(formData.get("taxpayerId") ?? "");
  const yearValue = String(formData.get("year") ?? "");
  const year = Number.parseInt(yearValue, 10);
  if (!taxpayerId) throw new Error("Identifiant manquant");
  if (!year || Number.isNaN(year)) throw new Error("Année invalide");

  const scopedCommune = await getScopedCommuneName();
  if (scopedCommune) {
    const taxpayer = await prisma.taxpayer.findUnique({ where: { id: taxpayerId }, select: { commune: true } });
    if (!taxpayer || taxpayer.commune !== scopedCommune) {
      throw new Error("Accès refusé pour cette commune");
    }
  }

  const notices = await prisma.notice.findMany({
    where: {
      taxpayerId,
      year,
    },
    select: { id: true },
  });

  if (notices.length === 0) {
    throw new Error("Aucune facture fiscale pour cette année");
  }

  const paymentCount = await prisma.payment.count({
    where: { noticeId: { in: notices.map((notice) => notice.id) } },
  });
  if (paymentCount > 0) {
    throw new Error("Suppression impossible: paiements existants.");
  }

  await prisma.notice.deleteMany({
    where: { id: { in: notices.map((notice) => notice.id) } },
  });

  await logAudit({
    action: "NOTICE_DELETED",
    entityType: "NOTICE",
    entityId: taxpayerId,
    after: { year, deletedCount: notices.length },
  });

  revalidatePath(`/taxpayers/${taxpayerId}`);
  revalidatePath("/taxpayers");
}

export async function deleteTaxpayer(formData: FormData) {
  await assertCsrfToken(formData);
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") {
    throw new Error("Accès refusé");
  }

  const taxpayerId = String(formData.get("taxpayerId") ?? "");
  if (!taxpayerId) throw new Error("Identifiant manquant");

  const before = await prisma.taxpayer.findUnique({ where: { id: taxpayerId } });

  await prisma.notice.deleteMany({ where: { taxpayerId } });
  await prisma.taxpayer.delete({ where: { id: taxpayerId } });

  await logAudit({
    action: "TAXPAYER_DELETED",
    entityType: "TAXPAYER",
    entityId: taxpayerId,
    before,
  });

  revalidatePath("/taxpayers");
}

export async function updateTaxpayerMeasures(formData: FormData) {
  await assertCsrfToken(formData);
  const taxpayerId = String(formData.get("taxpayerId") ?? "");
  if (!taxpayerId) throw new Error("Identifiant manquant");
  const scopedCommune = await getScopedCommuneName();
  if (scopedCommune) {
    const taxpayer = await prisma.taxpayer.findUnique({ where: { id: taxpayerId }, select: { commune: true } });
    if (!taxpayer || taxpayer.commune !== scopedCommune) {
      throw new Error("Accès refusé pour cette commune");
    }
  }

  const entries = Array.from(formData.entries())
    .filter(([key]) => key.startsWith("measure_"))
    .map(([key, value]) => ({
      taxId: key.replace("measure_", ""),
      quantity: String(value),
    }))
    .filter((entry) => entry.quantity && Number(entry.quantity) >= 0);

  await prisma.taxpayerMeasure.deleteMany({ where: { taxpayerId } });

  const payload = entries.filter((entry) => Number(entry.quantity) > 0);
  if (payload.length > 0) {
    await prisma.taxpayerMeasure.createMany({
      data: payload.map((entry) => ({
        taxpayerId,
        taxId: entry.taxId,
        quantity: entry.quantity,
      })),
    });
  }

  revalidatePath(`/taxpayers/${taxpayerId}`);
}

export async function calculateTaxpayerNotice(formData: FormData) {
  await assertCsrfToken(formData);
  const taxpayerId = String(formData.get("taxpayerId") ?? "");
  if (!taxpayerId) {
    return { ok: false, message: "Identifiant manquant." };
  }
  const yearValue = String(formData.get("year") ?? "");
  const year = Number.parseInt(yearValue, 10);
  if (!year || Number.isNaN(year)) {
    return { ok: false, message: "Année invalide." };
  }
  const scopedCommune = await getScopedCommuneName();
  if (scopedCommune) {
    const taxpayer = await prisma.taxpayer.findUnique({
      where: { id: taxpayerId },
      select: { commune: true, status: true },
    });
    if (!taxpayer || taxpayer.commune !== scopedCommune) {
      return { ok: false, message: "Accès refusé pour cette commune." };
    }
    if (taxpayer.status === "EN_ATTENTE") {
      return { ok: false, message: "Contribuable en attente. Veuillez l'approuver." };
    }
  } else {
    const taxpayer = await prisma.taxpayer.findUnique({ where: { id: taxpayerId }, select: { status: true } });
    if (taxpayer?.status === "EN_ATTENTE") {
      return { ok: false, message: "Contribuable en attente. Veuillez l'approuver." };
    }
  }

  try {
    const notice = await calculateNoticeForTaxpayer(taxpayerId, year);
    await logAudit({
      action: "TAXPAYER_NOTICE_CALCULATED",
      entityType: "TAXPAYER",
      entityId: taxpayerId,
      after: { noticeId: notice.id, year },
    });
    revalidatePath(`/taxpayers/${taxpayerId}`);
    revalidatePath("/taxpayers");
    return { ok: true, message: "Calcul terminé avec succès." };
  } catch {
    return { ok: false, message: "Le calcul a échoué. Réessayez." };
  }
}
