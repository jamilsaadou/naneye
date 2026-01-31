import type { NoticeStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession, getUserWithCommune } from "@/lib/auth";

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Impayé",
  PARTIAL: "Paiement partiel",
  PAID: "Payé",
};

const STATUS_FILENAMES: Record<string, string> = {
  UNPAID: "avis-impayes.xlsx",
  PARTIAL: "avis-paiements-partiels.xlsx",
  PAID: "avis-payes.xlsx",
  ALL: "avis-imposition.xlsx",
};

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function parseAmount(value: string | null) {
  if (!value) return null;
  const normalized = value.replace(/,/g, ".");
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) return null;
  return amount;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserWithCommune();
  if (!user) {
    return NextResponse.json({ message: "Session invalide" }, { status: 401 });
  }

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") ?? "ALL").toUpperCase();
  const start = parseDate(url.searchParams.get("start"));
  const end = parseDate(url.searchParams.get("end"), true);
  const groupId = url.searchParams.get("groupId");
  const category = url.searchParams.get("category");
  const communeParam = url.searchParams.get("commune");
  const neighborhood = url.searchParams.get("neighborhood");
  const minTotal = parseAmount(url.searchParams.get("minTotal"));
  const maxTotal = parseAmount(url.searchParams.get("maxTotal"));
  const minPaid = parseAmount(url.searchParams.get("minPaid"));
  const maxPaid = parseAmount(url.searchParams.get("maxPaid"));

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const commune = scopedCommune ?? communeParam;
  const statusFilter =
    statusParam === "ALL" || !STATUS_LABELS[statusParam]
      ? {}
      : { status: statusParam as NoticeStatus };

  const amountFilter = {
    ...(minTotal !== null || maxTotal !== null
      ? {
          totalAmount: {
            ...(minTotal !== null ? { gte: minTotal } : {}),
            ...(maxTotal !== null ? { lte: maxTotal } : {}),
          },
        }
      : {}),
    ...(minPaid !== null || maxPaid !== null
      ? {
          amountPaid: {
            ...(minPaid !== null ? { gte: minPaid } : {}),
            ...(maxPaid !== null ? { lte: maxPaid } : {}),
          },
        }
      : {}),
  };

  const taxpayerFilter = {
    ...(commune ? { commune } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(category ? { category } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const notices = await prisma.notice.findMany({
    where: {
      ...(statusFilter ?? {}),
      ...(amountFilter ?? {}),
      ...(start || end
        ? {
            createdAt: {
              ...(start ? { gte: start } : {}),
              ...(end ? { lte: end } : {}),
            },
          }
        : {}),
      ...(Object.keys(taxpayerFilter).length > 0 ? { taxpayer: taxpayerFilter } : {}),
    },
    include: { taxpayer: true },
    orderBy: { createdAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion des taxes";
  const worksheet = workbook.addWorksheet("Avis");
  worksheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Avis", key: "notice", width: 18 },
    { header: "Contribuable", key: "taxpayer", width: 28 },
    { header: "Code contribuable", key: "code", width: 18 },
    { header: "Téléphone", key: "phone", width: 16 },
    { header: "Commune", key: "commune", width: 16 },
    { header: "Statut", key: "status", width: 16 },
    { header: "Montant total", key: "total", width: 16 },
    { header: "Montant payé", key: "paid", width: 16 },
    { header: "Reste à payer", key: "remaining", width: 16 },
  ];

  notices.forEach((notice) => {
    const total = Number(notice.totalAmount);
    const paid = Number(notice.amountPaid);
    worksheet.addRow({
      date: notice.createdAt,
      notice: notice.number,
      taxpayer: notice.taxpayer.name,
      code: notice.taxpayer.code ?? "",
      phone: notice.taxpayer.phone ?? "",
      commune: notice.taxpayer.commune ?? "",
      status: STATUS_LABELS[notice.status] ?? notice.status,
      total,
      paid,
      remaining: total - paid,
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn("date").numFmt = "dd/mm/yyyy hh:mm";
  worksheet.getColumn("total").numFmt = "#,##0.00";
  worksheet.getColumn("paid").numFmt = "#,##0.00";
  worksheet.getColumn("remaining").numFmt = "#,##0.00";

  const filename = STATUS_FILENAMES[statusParam] ?? STATUS_FILENAMES.ALL;
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
