import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyCollectorRequest } from "@/lib/collector-api";

const taxDetailsSchema = z.object({
  noticeNumber: z.string().min(3),
  taxpayerCode: z.string().min(2),
});

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => null);
  const parsed = taxDetailsSchema.safeParse(body);

  const noticeNumber = parsed.success
    ? parsed.data.noticeNumber
    : (body?.noticeNumber as string | undefined) ?? null;

  let collectorId: string | null = null;
  let jwtTxnId: string | null = null;
  let jwtIssuer: string | null = null;

  try {
    if (!parsed.success) {
      throw new Error("Données invalides");
    }

    const { payload, collector } = await verifyCollectorRequest(authHeader, null);
    collectorId = collector.id;
    jwtTxnId = payload.txnId ?? null;
    jwtIssuer = payload.iss ?? null;

    const notice = await prisma.notice.findFirst({
      where: { number: parsed.data.noticeNumber },
      include: {
        taxpayer: true,
      },
    });

    if (!notice) {
      throw new Error("Avis introuvable");
    }

    if (!notice.taxpayer.code || notice.taxpayer.code !== parsed.data.taxpayerCode) {
      throw new Error("Identifiants invalides");
    }

    const responsePayload = {
      ok: true,
      taxpayer: {
        code: notice.taxpayer.code,
        name: notice.taxpayer.name,
        category: notice.taxpayer.category,
        phone: notice.taxpayer.phone,
        email: notice.taxpayer.email,
        address: notice.taxpayer.address,
        commune: notice.taxpayer.commune,
        neighborhood: notice.taxpayer.neighborhood,
      },
      notice: {
        number: notice.number,
        year: notice.year,
        periodStart: notice.periodStart.toISOString(),
        periodEnd: notice.periodEnd.toISOString(),
        status: notice.status,
        totalAmount: Number(notice.totalAmount),
        amountPaid: Number(notice.amountPaid),
      },
    };

    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber: parsed.data.noticeNumber,
        requestTxnId: null,
        jwtTxnId,
        jwtIssuer,
        status: "SUCCESS",
        message: "Details avis recus",
        requestPayload: body,
        responsePayload: responsePayload,
      },
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber: noticeNumber ?? null,
        requestTxnId: null,
        jwtTxnId,
        jwtIssuer,
        status: "FAILED",
        message,
        requestPayload: body ?? null,
        responsePayload: { ok: false, message },
      },
    });

    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
