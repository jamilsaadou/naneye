import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export type AuditPayload = {
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown | null;
  after?: unknown | null;
};

export async function logAudit(payload: AuditPayload) {
  const session = await getSession();
  const actorId = session?.id
    ? (await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } }))?.id ?? null
    : null;
  await prisma.auditLog.create({
    data: {
      actorId,
      action: payload.action,
      entityType: payload.entityType,
      entityId: payload.entityId,
      before: payload.before ?? undefined,
      after: payload.after ?? undefined,
    },
  });
}
