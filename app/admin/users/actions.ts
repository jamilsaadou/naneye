"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { MODULE_IDS } from "@/lib/modules";
import { hashPassword } from "@/lib/passwords";
import { assertCsrfToken } from "@/lib/csrf";

const roleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "AGENT", "CAISSIER", "AUDITEUR"]);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
  role: roleSchema,
  password: z.string().min(6),
  communeId: z.string().optional().nullable(),
  supervisorId: z.string().optional().nullable(),
});

const updateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional().nullable(),
  role: roleSchema,
  password: z.string().min(6).optional().nullable(),
  communeId: z.string().optional().nullable(),
  supervisorId: z.string().optional().nullable(),
});

export async function createUser(formData: FormData) {
  await assertCsrfToken(formData);
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = createUserSchema.safeParse({
    email: raw.email ?? "",
    name: raw.name || null,
    role: raw.role ?? "AGENT",
    password: raw.password ?? "",
    communeId: raw.communeId || null,
    supervisorId: raw.supervisorId || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }
  if (parsed.data.role !== "SUPER_ADMIN" && !parsed.data.communeId) {
    throw new Error("Commune obligatoire pour ce role");
  }

  if (parsed.data.supervisorId) {
    const supervisor = await prisma.user.findUnique({
      where: { id: parsed.data.supervisorId },
      select: { id: true, role: true, communeId: true },
    });
    if (!supervisor) {
      throw new Error("Superieur hierarchique introuvable");
    }
    if (supervisor.role !== "SUPER_ADMIN" && supervisor.role !== "ADMIN") {
      throw new Error("Superieur hierarchique invalide");
    }
    if (parsed.data.communeId) {
      if (supervisor.communeId && supervisor.communeId !== parsed.data.communeId) {
        throw new Error("Le superieur doit etre dans la meme commune ou global");
      }
    } else if (supervisor.communeId) {
      throw new Error("Le superieur doit etre global pour un compte global");
    }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    throw new Error("Email déjà utilisé");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      role: parsed.data.role,
      passwordHash,
      enabledModules: [...MODULE_IDS],
      communeId: parsed.data.communeId,
      supervisorId: parsed.data.supervisorId,
    },
  });

  revalidatePath("/admin/users");
}

export async function updateUser(formData: FormData) {
  await assertCsrfToken(formData);
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Identifiant manquant");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const modules = formData
    .getAll("modules")
    .map((value) => String(value))
    .filter((value): value is typeof MODULE_IDS[number] => MODULE_IDS.includes(value as typeof MODULE_IDS[number]));
  const accessibleCommuneIds = formData
    .getAll("accessibleCommuneIds")
    .map((value) => String(value))
    .filter(Boolean);
  const parsed = updateUserSchema.safeParse({
    email: raw.email ?? "",
    name: raw.name || null,
    role: raw.role ?? "AGENT",
    password: raw.password || null,
    communeId: raw.communeId || null,
    supervisorId: raw.supervisorId || null,
  });

  if (!parsed.success) {
    throw new Error("Données invalides");
  }

  // SUPER_ADMIN et ADMIN peuvent ne pas avoir de commune principale
  // ADMIN doit avoir au moins une commune accessible ou une commune principale
  const hasCommune = parsed.data.communeId || accessibleCommuneIds.length > 0;
  if (parsed.data.role !== "SUPER_ADMIN" && parsed.data.role !== "ADMIN" && !parsed.data.communeId) {
    throw new Error("Commune obligatoire pour ce role");
  }
  if (parsed.data.role === "ADMIN" && !hasCommune) {
    throw new Error("Un admin doit avoir au moins une commune accessible");
  }

  if (parsed.data.supervisorId) {
    if (parsed.data.supervisorId === id) {
      throw new Error("Un utilisateur ne peut pas etre son propre superieur");
    }
    const supervisor = await prisma.user.findUnique({
      where: { id: parsed.data.supervisorId },
      select: { id: true, role: true, communeId: true },
    });
    if (!supervisor) {
      throw new Error("Superieur hierarchique introuvable");
    }
    if (supervisor.role !== "SUPER_ADMIN" && supervisor.role !== "ADMIN") {
      throw new Error("Superieur hierarchique invalide");
    }
    // Validation simplifiée pour les admins avec communes accessibles
    if (parsed.data.communeId && supervisor.communeId && supervisor.communeId !== parsed.data.communeId) {
      throw new Error("Le superieur doit etre dans la meme commune ou global");
    }
  }

  const existing = await prisma.user.findFirst({
    where: { email: parsed.data.email, NOT: { id } },
  });
  if (existing) {
    throw new Error("Email déjà utilisé");
  }

  const passwordHash = parsed.data.password ? await hashPassword(parsed.data.password) : null;
  await prisma.user.update({
    where: { id },
    data: {
      email: parsed.data.email,
      name: parsed.data.name ?? null,
      role: parsed.data.role,
      enabledModules: modules,
      communeId: parsed.data.communeId,
      supervisorId: parsed.data.supervisorId,
      accessibleCommunes: {
        set: accessibleCommuneIds.map((communeId) => ({ id: communeId })),
      },
      ...(passwordHash ? { passwordHash } : {}),
    },
  });

  revalidatePath("/admin/users");
  revalidatePath(`/admin/users/${id}`);
}
