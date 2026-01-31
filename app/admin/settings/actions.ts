"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateNoticesForAllTaxpayers } from "@/lib/tax-calculation";
import { logAudit } from "@/lib/audit";

const settingsSchema = z.object({
  municipalityName: z.string().min(2),
  municipalityLogo: z.string().optional().nullable(),
  primaryColor: z.string().optional().nullable(),
  backgroundColor: z.string().optional().nullable(),
  foregroundColor: z.string().optional().nullable(),
  mutedColor: z.string().optional().nullable(),
  borderColor: z.string().optional().nullable(),
  defaultCurrency: z.string().min(2),
  timezone: z.string().min(2),
  receiptFooter: z.string().optional().nullable(),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

async function storeLogo(file: File) {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_") : "logo";
  const filename = `${randomUUID()}-${safeName}`;
  const filePath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

export async function updateSettings(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = settingsSchema.safeParse({
    municipalityName: getString(raw.municipalityName),
    municipalityLogo: getString(raw.municipalityLogo) || null,
    primaryColor: getString(raw.primaryColor) || null,
    backgroundColor: getString(raw.backgroundColor) || null,
    foregroundColor: getString(raw.foregroundColor) || null,
    mutedColor: getString(raw.mutedColor) || null,
    borderColor: getString(raw.borderColor) || null,
    defaultCurrency: getString(raw.defaultCurrency) || "XOF",
    timezone: getString(raw.timezone) || "Africa/Niamey",
    receiptFooter: getString(raw.receiptFooter) || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  let logoUrl = parsed.data.municipalityLogo;
  const logoFile = formData.get("logoFile");
  if (logoFile instanceof File && logoFile.size > 0) {
    logoUrl = await storeLogo(logoFile);
  }

  await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      ...parsed.data,
      municipalityLogo: logoUrl,
    },
    create: {
      id: "main-settings",
      ...parsed.data,
      municipalityLogo: logoUrl,
    },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/");
  return { ok: true, message: "Paramètres enregistrés." };
}

export async function calculateAllTaxNotices(formData?: FormData) {
  try {
    const yearValue = formData ? String(formData.get("year") ?? "") : "";
    const year = Number.parseInt(yearValue, 10);
    if (!year || Number.isNaN(year)) {
      return { ok: false, message: "Année invalide." };
    }
    await calculateNoticesForAllTaxpayers(year);
    await logAudit({
      action: "GLOBAL_NOTICE_CALCULATED",
      entityType: "SYSTEM",
      entityId: "GLOBAL",
      after: { year },
    });
    revalidatePath("/admin/settings");
    revalidatePath("/taxpayers");
    return { ok: true, message: "Calcul global terminé." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Le calcul global a échoué. Réessayez.";
    return { ok: false, message };
  }
}
