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
  return prisma.user.findUnique({
    where: { id: session.id },
    include: { commune: true },
  });
}
