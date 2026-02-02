"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendCollectorCredentials, sendCollectorResetCredentials } from "@/lib/smtp";
import { assertCsrfToken } from "@/lib/csrf";
import { encryptSecret } from "@/lib/encryption";

const statusSchema = z.enum(["ACTIVE", "SUSPENDED"]);

const collectorBaseSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  phone: z.string().min(6),
  email: z.string().email().optional().nullable(),
  status: statusSchema,
});

const collectorCreateSchema = collectorBaseSchema.extend({
  email: z.string().email(),
});

function generateCollectorPassword() {
  return randomBytes(9).toString("base64url");
}

export async function createCollector(formData: FormData) {
  await assertCsrfToken(formData);
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = collectorCreateSchema.safeParse({
    code: raw.code ?? "",
    name: raw.name ?? "",
    phone: raw.phone ?? "",
    email: raw.email || null,
    status: raw.status ? String(raw.status) : "ACTIVE",
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const existing = await prisma.collector.findUnique({ where: { code: parsed.data.code } });
  if (existing) {
    throw new Error("Code collecteur déjà utilisé");
  }

  const password = generateCollectorPassword();
  const encryptedSecret = encryptSecret(password);

  const collector = await prisma.collector.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      status: parsed.data.status,
      jwtSecret: encryptedSecret,
    },
  });

  try {
    await sendCollectorCredentials({
      to: parsed.data.email,
      name: parsed.data.name,
      code: parsed.data.code,
      password,
    });
  } catch (error) {
    await prisma.collector.delete({ where: { id: collector.id } });
    const message = error instanceof Error ? error.message : "Envoi email impossible.";
    throw new Error(message);
  }

  revalidatePath("/collectors");
}

export async function updateCollector(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = collectorBaseSchema.safeParse({
    code: raw.code ?? "",
    name: raw.name ?? "",
    phone: raw.phone ?? "",
    email: raw.email || null,
    status: raw.status ? String(raw.status) : "ACTIVE",
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  const existing = await prisma.collector.findFirst({
    where: { code: parsed.data.code, NOT: { id } },
  });
  if (existing) {
    throw new Error("Code collecteur déjà utilisé");
  }

  await prisma.collector.update({
    where: { id },
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      status: parsed.data.status,
    },
  });

  revalidatePath("/collectors");
}

export async function setCollectorStatus(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  await prisma.collector.update({
    where: { id },
    data: { status: statusSchema.parse(status) },
  });

  revalidatePath("/collectors");
}

export async function resetCollectorCredentials(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const collector = await prisma.collector.findUnique({ where: { id } });
  if (!collector) {
    throw new Error("Collecteur introuvable");
  }
  if (!collector.email) {
    throw new Error("Email collecteur manquant");
  }

  const password = generateCollectorPassword();
  const encryptedSecret = encryptSecret(password);
  const previousSecret = collector.jwtSecret ?? null;

  await prisma.collector.update({
    where: { id },
    data: { jwtSecret: encryptedSecret },
  });

  try {
    await sendCollectorResetCredentials({
      to: collector.email,
      name: collector.name,
      code: collector.code,
      password,
    });
  } catch (error) {
    await prisma.collector.update({
      where: { id },
      data: { jwtSecret: previousSecret },
    });
    const message = error instanceof Error ? error.message : "Envoi email impossible.";
    return { ok: false, message };
  }

  revalidatePath("/collectors");
  return { ok: true, message: "Accès réinitialisé. Email envoyé." };
}
