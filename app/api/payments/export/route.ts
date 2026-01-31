import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession, getUserWithCommune } from "@/lib/auth";

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
  const startParam = url.searchParams.get("start");
  const endParam = url.searchParams.get("end");
  const start = startParam ? new Date(startParam) : null;
  const end = endParam ? new Date(endParam) : null;
  const startValid = start && !Number.isNaN(start.getTime()) ? start : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const payments = await prisma.payment.findMany({
    where: {
      createdById: user.id,
      ...(startValid || endValid
        ? {
            paidAt: {
              ...(startValid ? { gte: startValid } : {}),
              ...(endValid ? { lte: endValid } : {}),
            },
          }
        : {}),
      ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
    },
    include: { collector: true, notice: { include: { taxpayer: true } } },
    orderBy: { paidAt: "desc" },
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion des taxes";
  const worksheet = workbook.addWorksheet("Encaissements");
  worksheet.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Contribuable", key: "taxpayer", width: 28 },
    { header: "Commune", key: "commune", width: 16 },
    { header: "Avis", key: "notice", width: 18 },
    { header: "Montant", key: "amount", width: 14 },
    { header: "Méthode", key: "method", width: 16 },
    { header: "Collecteur", key: "collector", width: 18 },
  ];

  payments.forEach((payment) => {
    worksheet.addRow({
      date: payment.paidAt,
      taxpayer: payment.notice.taxpayer.name,
      commune: payment.notice.taxpayer.commune,
      notice: payment.notice.number,
      amount: Number(payment.amount),
      method: payment.method,
      collector: payment.collector?.name ?? "Interne",
    });
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle" };
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  worksheet.getColumn("date").numFmt = "dd/mm/yyyy hh:mm";
  worksheet.getColumn("amount").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=encaissements.xlsx",
    },
  });
}
