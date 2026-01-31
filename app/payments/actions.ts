"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession, getUserWithCommune } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { assertCsrfToken } from "@/lib/csrf";
import { storeUpload, UploadPresets } from "@/lib/uploads";

async function storePaymentProof(file: File) {
  return storeUpload(file, UploadPresets.proof);
}

const lookupSchema = z.object({
  taxpayerCode: z.string().min(3),
  noticeNumber: z.string().min(3),
});

const paymentSchema = z.object({
  taxpayerId: z.string().min(1),
  noticeId: z.string().min(1),
  amount: z.string().min(1),
  method: z.enum(["CASH", "TRANSFER", "CHEQUE"]),
});

export async function lookupPaymentInfo(formData: FormData) {
  await assertCsrfToken(formData);
  const session = await getSession();
  if (!session) throw new Error("Acces refuse");

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = lookupSchema.safeParse({
    taxpayerCode: raw.taxpayerCode ?? "",
    noticeNumber: raw.noticeNumber ?? "",
  });
  if (!parsed.success) throw new Error("Donnees invalides");

  const user = await getUserWithCommune();
  if (!user) throw new Error("Session invalide");
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const taxpayer = await prisma.taxpayer.findFirst({ where: { code: parsed.data.taxpayerCode } });
  if (!taxpayer) throw new Error("Contribuable introuvable");
  if (scopedCommune && taxpayer.commune !== scopedCommune) {
    throw new Error("Acces refuse pour cette commune");
  }

  const notice = await prisma.notice.findFirst({
    where: { number: parsed.data.noticeNumber, taxpayerId: taxpayer.id },
  });
  if (!notice) throw new Error("Avis introuvable pour ce contribuable");

  return {
    ok: true,
    payload: {
      taxpayer: {
        id: taxpayer.id,
        name: taxpayer.name,
        code: taxpayer.code,
        commune: taxpayer.commune,
      },
      notice: {
        id: notice.id,
        number: notice.number,
        year: notice.year,
        totalAmount: Number(notice.totalAmount),
        amountPaid: Number(notice.amountPaid),
      },
    },
  };
}

export async function createManualPaymentFromLookup(formData: FormData) {
  await assertCsrfToken(formData);
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN" && session.role !== "CAISSIER")) {
    throw new Error("Acces refuse");
  }

  const raw = Object.fromEntries(formData.entries()) as Record<string, FormDataEntryValue>;
  const parsed = paymentSchema.safeParse({
    taxpayerId: typeof raw.taxpayerId === "string" ? raw.taxpayerId : "",
    noticeId: typeof raw.noticeId === "string" ? raw.noticeId : "",
    amount: typeof raw.amount === "string" ? raw.amount : "",
    method: (typeof raw.method === "string" ? raw.method : "CASH") as "CASH",
  });

  if (!parsed.success) {
    throw new Error("Donnees invalides");
  }

  const proofFile = formData.get("proofFile");
  const requiresProof = parsed.data.method === "TRANSFER" || parsed.data.method === "CHEQUE";
  const proofUrl =
    proofFile instanceof File && proofFile.size > 0 ? await storePaymentProof(proofFile) : null;
  if (requiresProof && !proofUrl) {
    throw new Error("Preuve de paiement requise pour virement ou cheque");
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error("Montant invalide");
  }

  const user = await getUserWithCommune();
  if (!user) {
    throw new Error("Session invalide");
  }
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const taxpayer = await prisma.taxpayer.findUnique({ where: { id: parsed.data.taxpayerId } });
  if (!taxpayer) throw new Error("Contribuable introuvable");
  if (scopedCommune && taxpayer.commune !== scopedCommune) {
    throw new Error("Acces refuse pour cette commune");
  }

  const notice = await prisma.notice.findFirst({
    where: { id: parsed.data.noticeId, taxpayerId: taxpayer.id },
  });
  if (!notice) throw new Error("Avis introuvable");

  const remaining = new Prisma.Decimal(notice.totalAmount).sub(new Prisma.Decimal(notice.amountPaid ?? 0));
  const paymentAmount = new Prisma.Decimal(amountValue);
  if (paymentAmount.gt(remaining)) {
    throw new Error("Montant superieur au solde a payer");
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        noticeId: notice.id,
        collectorId: null,
        amount: paymentAmount,
        method: parsed.data.method,
        proofUrl,
        paidAt: new Date(),
        createdById: session.id,
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
  });

  await logAudit({
    action: "PAYMENT_MANUAL_CREATED",
    entityType: "NOTICE",
    entityId: notice.id,
    after: {
      taxpayerName: taxpayer.name,
      noticeNumber: notice.number,
      amount: paymentAmount.toString(),
      method: parsed.data.method,
      proofUrl,
    },
  });

  revalidatePath("/payments");
  revalidatePath(`/taxpayers/${taxpayer.id}`);
  revalidatePath("/taxpayers");

  return { ok: true, message: "Paiement enregistre." };
}
