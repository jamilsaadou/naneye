"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertCsrfToken } from "@/lib/csrf";

const apiSchema = z.object({
  apiBaseUrl: z.string().url().optional().nullable(),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateApiSettings(formData: FormData) {
  await assertCsrfToken(formData);
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = apiSchema.safeParse({
    apiBaseUrl: getString(raw.apiBaseUrl) || null,
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Données invalides";
    throw new Error(message);
  }

  await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      apiBaseUrl: parsed.data.apiBaseUrl,
    },
    create: {
      id: "main-settings",
      municipalityName: "Commune",
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      apiBaseUrl: parsed.data.apiBaseUrl,
    },
  });

  revalidatePath("/admin/settings/api");
  return { ok: true, message: "URL de base API enregistrée." };
}
