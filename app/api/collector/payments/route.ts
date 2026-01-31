import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifyCollectorRequest } from "@/lib/collector-api";

const paymentSchema = z.object({
  noticeNumber: z.string().min(3),
  taxpayerCode: z.string().min(2),
  AmountCollected: z.number().positive(),
  ReferenceID: z.string().min(1),
  DateofPayment: z.number().int().positive(),
});

const paymentLookupSchema = z.object({
  noticeNumber: z.string().min(3),
});

async function getSystemUserId() {
  const email = "system@taxes.local";
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "System API" },
    create: { email, name: "System API", role: "AUDITEUR", passwordHash: "-" },
  });
  return user.id;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const parsed = paymentLookupSchema.safeParse({
    noticeNumber: searchParams.get("noticeNumber") ?? "",
  });

  let collectorId: string | null = null;
  let jwtTxnId: string | null = null;
  let jwtIssuer: string | null = null;
  let noticeNumber: string | null = null;

  try {
    if (!parsed.success) {
      throw new Error("noticeNumber manquant");
    }

    const { payload, collector } = await verifyCollectorRequest(authHeader, null);
    collectorId = collector.id;
    jwtTxnId = payload.txnId ?? null;
    jwtIssuer = payload.iss ?? null;

    const notice = await prisma.notice.findFirst({
      where: { number: parsed.data.noticeNumber },
      include: { taxpayer: true, payments: true },
    });
    if (!notice) {
      throw new Error("Avis introuvable");
    }

    noticeNumber = notice.number;

    const responsePayload = {
      ok: true,
      notice: {
        status: notice.status,
        totalAmount: Number(notice.totalAmount),
        amountPaid: Number(notice.amountPaid),
        noticeNumber: notice.number,
      },
      taxpayer: {
        id: notice.taxpayer.id,
        code: notice.taxpayer.code,
        name: notice.taxpayer.name,
        phone: notice.taxpayer.phone,
        email: notice.taxpayer.email,
        commune: notice.taxpayer.commune,
        neighborhood: notice.taxpayer.neighborhood,
      },
      payments: notice.payments.map((payment) => ({
        id: payment.id,
        referenceId: payment.externalTxnId,
        amount: Number(payment.amount),
        method: payment.method,
        paidAt: payment.paidAt.toISOString(),
      })),
    };

    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber: notice.number,
        requestTxnId: null,
        jwtTxnId,
        jwtIssuer,
        status: "SUCCESS",
        message: "Paiement recupere",
        requestPayload: { noticeNumber: parsed.data.noticeNumber },
        responsePayload,
      },
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber,
        requestTxnId: null,
        jwtTxnId,
        jwtIssuer,
        status: "FAILED",
        message,
        requestPayload: {
          noticeNumber: searchParams.get("noticeNumber"),
        },
        responsePayload: { ok: false, message },
      },
    });

    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const body = await request.json().catch(() => null);
  const parsed = paymentSchema.safeParse(body);

  const noticeNumber = parsed.success ? parsed.data.noticeNumber : (body?.noticeNumber as string | undefined) ?? null;

  let collectorId: string | null = null;
  let jwtTxnId: string | null = null;
  let jwtIssuer: string | null = null;

  try {
    if (!parsed.success) {
      throw new Error("Donnees invalides");
    }

    const { payload, collector } = await verifyCollectorRequest(authHeader, null);
    collectorId = collector.id;
    jwtTxnId = payload.txnId ?? null;
    jwtIssuer = payload.iss ?? null;

    const notice = await prisma.notice.findFirst({
      where: { number: parsed.data.noticeNumber },
      include: { taxpayer: true },
    });
    if (!notice) {
      throw new Error("Avis introuvable");
    }

    if (!notice.taxpayer.code || notice.taxpayer.code !== parsed.data.taxpayerCode) {
      throw new Error("Contribuable non conforme");
    }

    const existing = await prisma.payment.findFirst({ where: { externalTxnId: parsed.data.ReferenceID } });
    if (existing) {
      await prisma.collectorApiLog.create({
        data: {
          collectorId,
          noticeNumber: parsed.data.noticeNumber,
          requestTxnId: parsed.data.ReferenceID,
          jwtTxnId,
          jwtIssuer,
          status: "IGNORED",
          message: "Paiement deja enregistre",
          requestPayload: body,
          responsePayload: { ok: true, message: "Paiement deja enregistre" },
        },
      });
      return NextResponse.json({ ok: true, message: "Paiement deja enregistre" });
    }

    const systemUserId = await getSystemUserId();
    const paymentAmount = new Prisma.Decimal(parsed.data.AmountCollected);
    const paidAt = new Date(parsed.data.DateofPayment);
    if (Number.isNaN(paidAt.getTime())) {
      throw new Error("DateofPayment invalide");
    }

    const updated = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          noticeId: notice.id,
          collectorId: collector.id,
          externalTxnId: parsed.data.ReferenceID,
          amount: paymentAmount,
          method: collector.name,
          paidAt,
          createdById: systemUserId,
        },
      });

      const newPaid = new Prisma.Decimal(notice.amountPaid).add(paymentAmount);
      const newStatus = newPaid.gte(notice.totalAmount)
        ? "PAID"
        : newPaid.gt(0)
          ? "PARTIAL"
          : "UNPAID";

      await tx.notice.update({
        where: { id: notice.id },
        data: {
          amountPaid: newPaid,
          status: newStatus,
        },
      });

      return payment;
    });

    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber: parsed.data.noticeNumber,
        requestTxnId: parsed.data.ReferenceID,
        jwtTxnId,
        jwtIssuer,
        status: "SUCCESS",
        message: "Paiement enregistre",
        requestPayload: body,
        responsePayload: { ok: true, paymentId: updated.id },
      },
    });

    return NextResponse.json({ ok: true, paymentId: updated.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    await prisma.collectorApiLog.create({
      data: {
        collectorId,
        noticeNumber: noticeNumber ?? null,
        requestTxnId: parsed.success ? parsed.data.ReferenceID : null,
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
