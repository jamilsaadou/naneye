import archiver from "archiver";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { NextResponse } from "next/server";
import { PassThrough, Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { calculateNoticeForTaxpayer } from "@/lib/tax-calculation";
import { getSession, getUserWithCommune } from "@/lib/auth";
import { resolveBulkFilters } from "@/lib/bulk-notice";

export const runtime = "nodejs";

function sanitizeFilename(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserWithCommune();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Session invalide" }, { status: 401 });
  }

  const url = new URL(request.url);
  const yearValue = url.searchParams.get("year") ?? "";
  const year = Number.parseInt(yearValue, 10);
  if (!year || Number.isNaN(year)) {
    return NextResponse.json({ ok: false, message: "Année invalide." }, { status: 400 });
  }

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  let filters;
  try {
    filters = resolveBulkFilters(
      {
        scope: url.searchParams.get("scope"),
        category: url.searchParams.get("category"),
        commune: url.searchParams.get("commune"),
        neighborhood: url.searchParams.get("neighborhood"),
        groupId: url.searchParams.get("groupId"),
        startedFrom: url.searchParams.get("startedFrom"),
        startedTo: url.searchParams.get("startedTo"),
      },
      scopedCommune,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Filtres invalides.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const taxpayers = await prisma.taxpayer.findMany({
    where: filters.where,
    select: { id: true },
  });

  if (taxpayers.length === 0) {
    return NextResponse.json({ ok: false, message: "Aucun contribuable ne correspond aux filtres." }, { status: 404 });
  }

  const taxpayerIds = taxpayers.map((taxpayer) => taxpayer.id);
  const existingNotices = await prisma.notice.findMany({
    where: { taxpayerId: { in: taxpayerIds }, year },
    select: { taxpayerId: true },
  });
  const existingSet = new Set(existingNotices.map((notice) => notice.taxpayerId));

  for (const taxpayer of taxpayers) {
    if (existingSet.has(taxpayer.id)) continue;
    try {
      await calculateNoticeForTaxpayer(taxpayer.id, year);
    } catch {
      // Ignore generation errors; they will be absent from the export.
    }
  }

  const notices = await prisma.notice.findMany({
    where: { taxpayerId: { in: taxpayerIds }, year },
    include: { taxpayer: true },
    orderBy: { number: "asc" },
  });

  if (notices.length === 0) {
    return NextResponse.json({ ok: false, message: "Aucun avis a télécharger." }, { status: 404 });
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  try {
    browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    context = await browser.newContext({
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur PDF";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  const filename = sanitizeFilename(`avis-imposition-${year}.zip`);
  const response = new Response(Readable.toWeb(stream) as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });

  (async () => {
    const errors: string[] = [];
    try {
      for (const notice of notices) {
        if (!context) break;
        let page = null as Awaited<ReturnType<BrowserContext["newPage"]>> | null;
        try {
          page = await context.newPage();
          await page.goto(`${baseUrl}/assessments/${notice.id}/print`, { waitUntil: "networkidle" });
          await page.emulateMedia({ media: "print" });
          const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
          });
          const fileName = sanitizeFilename(`avis-${notice.number}.pdf`);
          archive.append(pdfBuffer, { name: fileName });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Erreur PDF";
          errors.push(`avis ${notice.number}: ${message}`);
        } finally {
          if (page) await page.close();
        }
      }
    } finally {
      if (errors.length > 0) {
        archive.append(`${errors.join("\n")}\n`, { name: "erreurs.txt" });
      }
      if (context) await context.close();
      if (browser) await browser.close();
      await archive.finalize();
    }
  })();

  return response;
}
