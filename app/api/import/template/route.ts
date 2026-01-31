import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const SALUBRITE_CODE = "SALUBRITE";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const taxes = await prisma.tax.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
  });
  const measureTaxes = taxes.filter((tax) => tax.code.toUpperCase() !== SALUBRITE_CODE);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Gestion des taxes";

  const template = workbook.addWorksheet("Import Contribuables");
  const baseColumns = [
    { header: "Nom établissement *", key: "name", width: 28 },
    { header: "Téléphone *", key: "phone", width: 18 },
    { header: "Catégorie *", key: "category", width: 20 },
    { header: "Commune *", key: "commune", width: 18 },
    { header: "Quartier *", key: "neighborhood", width: 18 },
    { header: "Date début activité * (YYYY-MM-DD)", key: "startedAt", width: 24 },
    { header: "Email", key: "email", width: 24 },
    { header: "Adresse", key: "address", width: 26 },
    { header: "Latitude", key: "latitude", width: 12 },
    { header: "Longitude", key: "longitude", width: 12 },
    { header: "Groupe", key: "group", width: 18 },
    { header: "Statut (EN_ATTENTE/ACTIVE)", key: "status", width: 24 },
  ];

  const measureColumns = measureTaxes.map((tax) => ({
    header: `Mesure ${tax.code} (${tax.label})`,
    key: `measure_${tax.code}`,
    width: 18,
  }));

  template.columns = [...baseColumns, ...measureColumns];

  const headerRow = template.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", wrapText: true };
  headerRow.height = 28;
  template.views = [{ state: "frozen", ySplit: 1 }];

  const taxesSheet = workbook.addWorksheet("Taxes disponibles");
  taxesSheet.columns = [
    { header: "Code", key: "code", width: 14 },
    { header: "Libellé", key: "label", width: 28 },
    { header: "Taux", key: "rate", width: 12 },
    { header: "Actif", key: "active", width: 10 },
  ];
  taxes.forEach((tax) => {
    taxesSheet.addRow({
      code: tax.code,
      label: tax.label,
      rate: Number(tax.rate),
      active: tax.active ? "Oui" : "Non",
    });
  });
  const taxesHeader = taxesSheet.getRow(1);
  taxesHeader.font = { bold: true };
  taxesHeader.alignment = { vertical: "middle" };
  taxesSheet.views = [{ state: "frozen", ySplit: 1 }];
  taxesSheet.getColumn("rate").numFmt = "#,##0.00";

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = "modele-import-contribuables.xlsx";

  return new NextResponse(Buffer.from(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=${filename}`,
    },
  });
}
