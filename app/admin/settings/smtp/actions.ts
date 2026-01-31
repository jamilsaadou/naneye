"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSmtpTransport } from "@/lib/smtp";
import { decryptSmtpPassword, encryptSmtpPassword } from "@/lib/smtp-crypto";
import { assertCsrfToken } from "@/lib/csrf";

const smtpSchema = z.object({
  host: z
    .string()
    .min(2)
    .refine((value) => !value.includes("@"), "Serveur SMTP invalide (utilisez un nom d'hôte)."),
  port: z.number().int().min(1).max(65535),
  from: z.string().min(3),
  user: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  secure: z.boolean(),
  testEmail: z.string().email().optional().nullable(),
  intent: z.enum(["save", "test"]),
});

function getString(value: FormDataEntryValue | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

export async function updateSmtpSettings(formData: FormData) {
  await assertCsrfToken(formData);
  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const portValue = Number.parseInt(getString(raw.smtpPort), 10);
  const parsed = smtpSchema.safeParse({
    host: getString(raw.smtpHost),
    port: portValue,
    from: getString(raw.smtpFrom),
    user: getString(raw.smtpUser) || null,
    password: getString(raw.smtpPassword) || null,
    secure: raw.smtpSecure === "on" || raw.smtpSecure === "true",
    testEmail: getString(raw.testEmail) || null,
    intent: getString(raw.intent) === "test" ? "test" : "save",
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Données invalides";
    throw new Error(message);
  }

  const existing = await prisma.appSetting.findFirst({
    select: { smtpPassword: true },
  });
  const existingPassword = existing?.smtpPassword ? decryptSmtpPassword(existing.smtpPassword) : null;

  const passwordToUse = parsed.data.password || existingPassword || null;

  if (parsed.data.user && !passwordToUse) {
    throw new Error("Mot de passe SMTP manquant.");
  }

  if (parsed.data.intent === "test") {
    const transporter = createSmtpTransport({
      host: parsed.data.host,
      port: parsed.data.port,
      secure: parsed.data.secure,
      user: parsed.data.user,
      pass: passwordToUse,
      from: parsed.data.from,
    });

    await transporter.verify();

    if (parsed.data.testEmail) {
      await transporter.sendMail({
        from: parsed.data.from,
        to: parsed.data.testEmail,
        subject: "Test SMTP - Gestion des Taxes",
        text: "Connexion SMTP valide.",
      });
      return { ok: true, message: "Connexion SMTP OK. Email de test envoyé." };
    }

    return { ok: true, message: "Connexion SMTP OK." };
  }

  const encryptedPassword = parsed.data.password
    ? encryptSmtpPassword(parsed.data.password)
    : existing?.smtpPassword ?? null;

  await prisma.appSetting.upsert({
    where: { id: "main-settings" },
    update: {
      smtpHost: parsed.data.host,
      smtpPort: parsed.data.port,
      smtpSecure: parsed.data.secure,
      smtpUser: parsed.data.user,
      smtpPassword: parsed.data.user ? encryptedPassword : null,
      smtpFrom: parsed.data.from,
    },
    create: {
      id: "main-settings",
      municipalityName: "Commune",
      defaultCurrency: "XOF",
      timezone: "Africa/Niamey",
      smtpHost: parsed.data.host,
      smtpPort: parsed.data.port,
      smtpSecure: parsed.data.secure,
      smtpUser: parsed.data.user,
      smtpPassword: parsed.data.user ? encryptedPassword : null,
      smtpFrom: parsed.data.from,
    },
  });

  revalidatePath("/admin/settings/smtp");
  return { ok: true, message: "Configuration SMTP enregistrée." };
}
