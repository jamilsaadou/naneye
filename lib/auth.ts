import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

export type SessionUser = {
  id: string;
  role: Role;
};

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const decoded = await readSessionToken(raw);
  if (!decoded?.id || !decoded?.role) return null;
  return { id: decoded.id, role: decoded.role as Role };
}

export async function requireUser() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export async function getUserWithRole() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.id } });
}

export async function getUserWithCommune() {
  const session = await getSession();
  if (!session) return null;
  // Note: Utiliser as any pour contourner les types Prisma non régénérés
  // Exécuter `npx prisma generate` pour régénérer les types
  return (prisma.user.findUnique as any)({
    where: { id: session.id },
    include: { commune: true, accessibleCommunes: true },
  }) as Promise<{
    id: string;
    email: string;
    name: string | null;
    role: Role;
    communeId: string | null;
    supervisorId: string | null;
    commune: { id: string; name: string } | null;
    accessibleCommunes: Array<{ id: string; name: string }>;
  } | null>;
}

/**
 * Returns the list of commune names a user can access.
 * - SUPER_ADMIN: null (all communes)
 * - Others: accessible communes if set, otherwise primary commune
 */
export function getUserAccessibleCommuneNames(user: {
  role: string;
  commune: { name: string } | null;
  accessibleCommunes: Array<{ name: string }>;
}): string[] | null {
  if (user.role === "SUPER_ADMIN") {
    return null; // All communes
  }

  // If user has accessible communes configured, use those
  if (user.accessibleCommunes.length > 0) {
    return user.accessibleCommunes.map((c) => c.name);
  }

  // Otherwise, fall back to primary commune
  if (user.commune) {
    return [user.commune.name];
  }

  return [];
}

/**
 * Récupère les noms des communes accessibles pour la session actuelle.
 * - SUPER_ADMIN: null (toutes les communes)
 * - Autres: communes accessibles si configurées, sinon commune principale
 * @returns null pour accès illimité, [] pour aucun accès, [...] pour liste de communes
 */
export async function getSessionAccessibleCommunes(): Promise<string[] | null> {
  const session = await getSession();
  if (!session) {
    return [];
  }

  if (session.role === "SUPER_ADMIN") {
    return null; // Accès à toutes les communes
  }

  // Récupérer l'utilisateur avec ses communes accessibles
  // Note: Utiliser as any pour contourner les types Prisma non régénérés
  const user = await (prisma.user.findUnique as any)({
    where: { id: session.id },
    select: {
      commune: { select: { name: true } },
      accessibleCommunes: { select: { name: true } },
    },
  }) as { commune: { name: string } | null; accessibleCommunes: Array<{ name: string }> } | null;

  if (!user) {
    return [];
  }

  // Si des communes accessibles sont configurées, les utiliser
  if (user.accessibleCommunes && user.accessibleCommunes.length > 0) {
    return user.accessibleCommunes.map((c) => c.name);
  }

  // Sinon, utiliser la commune principale
  if (user.commune) {
    return [user.commune.name];
  }

  return [];
}
