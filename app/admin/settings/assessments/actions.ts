"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const templateSchema = z.object({
  assessmentHeader: z.string().optional().nullable(),
  assessmentFooter: z.string().optional().nullable(),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

async function storeTemplateImage(file: File) {
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  const safeName = file.name ? file.name.replace(/[^a-zA-Z0-9._-]/g, "_") : "template";
  const filename = `${randomUUID()}-${safeName}`;
  const filePath = path.join(uploadDir, filename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

export async function updateAssessmentTemplate(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = templateSchema.safeParse({
    assessmentHeader: getString(raw.assessmentHeader) || null,
    assessmentFooter: getString(raw.assessmentFooter) || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  let headerUrl = parsed.data.assessmentHeader;
  let footerUrl = parsed.data.assessmentFooter;
  const headerFile = formData.get("assessmentHeaderFile");
  const footerFile = formData.get("assessmentFooterFile");
  if (headerFile instanceof File && headerFile.size > 0) {
    headerUrl = await storeTemplateImage(headerFile);
  }
  if (footerFile instanceof File && footerFile.size > 0) {
    footerUrl = await storeTemplateImage(footerFile);
  }

  await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      assessmentHeader: headerUrl,
      assessmentFooter: footerUrl,
    },
    create: {
      id: "main-settings",
      municipalityName: "Commune",
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      assessmentHeader: headerUrl,
      assessmentFooter: footerUrl,
    },
  });

  revalidatePath("/admin/settings/assessments");
  return { ok: true, message: "Modèle d'avis enregistré." };
}
