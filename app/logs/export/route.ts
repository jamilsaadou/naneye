import { Prisma } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

const ACTION_LABELS: Record<string, string> = {
  NOTICE_REDUCTION_REQUESTED: "Demande de reduction",
  NOTICE_REDUCTION_APPLIED: "Reduction appliquee",
  NOTICE_REDUCTION_APPROVED: "Reduction approuvee",
  NOTICE_REDUCTION_REJECTED: "Reduction rejetee",
  NOTICE_REDUCTION: "Reduction",
  PAYMENT_MANUAL_CREATED: "Paiement manuel",
  TAXPAYER_CREATED: "Contribuable cree",
  TAXPAYER_UPDATED: "Contribuable mis a jour",
  TAXPAYER_ARCHIVED: "Contribuable archive",
  TAXPAYER_DELETED: "Contribuable supprime",
  NOTICE_DELETED: "Avis supprime",
  TAXPAYER_NOTICE_CALCULATED: "Avis calcule",
  GLOBAL_NOTICE_CALCULATED: "Calcul global des avis",
};

const ENTITY_LABELS: Record<string, string> = {
  NOTICE: "Avis d'imposition",
  TAXPAYER: "Contribuable",
  SYSTEM: "Systeme",
};

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function getEntityLabel(log: { entityType: string; entityId: string; after: Prisma.JsonValue | null }) {
  const label = ENTITY_LABELS[log.entityType] ?? log.entityType;
  const after = (log.after ?? null) as Record<string, any> | null;

  if (log.entityType === "TAXPAYER") {
    const code = after?.code ?? after?.taxpayerCode ?? null;
    return code ? `${label} - ${code}` : `${label} - ${log.entityId}`;
  }

  if (log.entityType === "NOTICE") {
    const noticeNumber = after?.noticeNumber ?? null;
    return noticeNumber ? `${label} - ${noticeNumber}` : `${label} - ${log.entityId}`;
  }

  return `${label} - ${log.entityId}`;
}

function describeLog(log: { action: string; after: Prisma.JsonValue | null }) {
  const after = (log.after ?? null) as Record<string, any> | null;
  if (!after) return "-";

  if (log.action.startsWith("NOTICE_REDUCTION")) {
    const taxpayer = after.taxpayerName ?? "-";
    const notice = after.noticeNumber ?? "-";
    const reduction = after.reduction ?? "-";
    const status = after.status ? ` · ${after.status}` : "";
    return `${taxpayer} · avis ${notice} · reduction ${reduction}${status}`;
  }

  if (log.action.startsWith("TAXPAYER")) {
    const name = after.name ?? after.taxpayerName ?? "-";
    const code = after.code ?? after.taxpayerCode ?? "-";
    return `${name} · ${code}`;
  }

  if (log.action.startsWith("PAYMENT")) {
    const notice = after.noticeNumber ?? "-";
    const amount = after.amount ?? "-";
    const method = after.method ?? "-";
    return `avis ${notice} · montant ${amount} · ${method}`;
  }

  if (log.action === "GLOBAL_NOTICE_CALCULATED") {
    return `annee ${after.year ?? "-"}`;
  }

  return "-";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const actionParam = url.searchParams.get("action") ?? "all";
  const actorParam = url.searchParams.get("actorId") ?? "all";
  const fromDate = parseDate(url.searchParams.get("from"));
  const toDate = parseDate(url.searchParams.get("to"), true);
  const limitParam = Number.parseInt(url.searchParams.get("limit") ?? "5000", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 5000;

  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(actionParam !== "all" ? { action: actionParam } : {}),
    ...(actorParam === "system"
      ? { actorId: null }
      : actorParam !== "all"
        ? { actorId: actorParam }
        : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion des taxes";
  const worksheet = workbook.addWorksheet("Journal");
  worksheet.columns = [
    { header: "Date", key: "date", width: 22 },
    { header: "Utilisateur", key: "actor", width: 22 },
    { header: "Action", key: "action", width: 26 },
    { header: "Entité", key: "entity", width: 26 },
    { header: "Détails", key: "details", width: 40 },
  ];

  logs.forEach((log) => {
    const actor = log.actor?.name ?? log.actor?.email ?? "Systeme";
    worksheet.addRow({
      date: log.createdAt,
      actor,
      action: ACTION_LABELS[log.action] ?? log.action,
      entity: getEntityLabel(log),
      details: describeLog(log),
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn("date").numFmt = "dd/mm/yyyy hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=journal-activites.xlsx",
    },
  });
}
