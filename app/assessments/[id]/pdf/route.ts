import { NextResponse } from "next/server";
import { chromium } from "playwright";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const baseUrl = process.env.APP_URL ?? "http://localhost:3000";
  const printUrl = `${baseUrl}/assessments/${id}/print`;

  try {
    const browser = await chromium.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const cookieHeader = request.headers.get("cookie") ?? "";
    const context = await browser.newContext({
      extraHTTPHeaders: cookieHeader ? { cookie: cookieHeader } : undefined,
    });
    const page = await context.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "14mm", right: "14mm" },
    });

    await context.close();
    await browser.close();

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="avis-imposition-${id}.pdf"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur PDF";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
