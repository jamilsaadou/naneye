"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const reductionSchema = z.object({
  taxpayerCode: z.string().min(3),
  noticeNumber: z.string().min(3),
  amount: z.string().min(1),
  reason: z.string().min(3),
});

export async function applyNoticeReduction(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Acces refuse");
  }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const parsed = reductionSchema.safeParse({
    taxpayerCode: raw.taxpayerCode ?? "",
    noticeNumber: raw.noticeNumber ?? "",
    amount: raw.amount ?? "",
    reason: raw.reason ?? "",
  });

  if (!parsed.success) {
    throw new Error("Donnees invalides");
  }

  const amountValue = Number(parsed.data.amount.replace(",", "."));
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    throw new Error("Montant invalide");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { commune: true },
  });
  if (!user) {
    throw new Error("Session invalide, reconnectez-vous.");
  }
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "ADMIN";
  const hasSupervisor = Boolean(user.supervisorId);
  if (!isAdmin && !hasSupervisor) {
    throw new Error("Acces refuse");
  }
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const requiresApproval = Boolean(user.supervisorId);

  const taxpayer = await prisma.taxpayer.findFirst({
    where: { code: parsed.data.taxpayerCode },
  });
  if (!taxpayer) {
    throw new Error("Contribuable introuvable");
  }
  if (scopedCommune && taxpayer.commune !== scopedCommune) {
    throw new Error("Acces refuse pour cette commune");
  }

  const notice = await prisma.notice.findFirst({
    where: { number: parsed.data.noticeNumber, taxpayerId: taxpayer.id },
  });
  if (!notice) {
    throw new Error("Avis introuvable pour ce contribuable");
  }

  const reduction = new Prisma.Decimal(amountValue);
  const currentTotal = new Prisma.Decimal(notice.totalAmount);
  const amountPaid = new Prisma.Decimal(notice.amountPaid ?? 0);
  const newTotal = currentTotal.sub(reduction);

  if (newTotal.lt(0)) {
    throw new Error("Reduction trop elevee");
  }
  if (newTotal.lt(amountPaid)) {
    throw new Error("Le montant ne peut pas etre inferieur au montant deja paye");
  }

  if (requiresApproval) {
    await prisma.noticeReduction.create({
      data: {
        noticeId: notice.id,
        taxpayerId: taxpayer.id,
        amount: reduction,
        previousTotal: currentTotal,
        newTotal,
        reason: parsed.data.reason,
        createdById: user.id,
        status: "PENDING",
      },
    });

    await logAudit({
      action: "NOTICE_REDUCTION_REQUESTED",
      entityType: "NOTICE",
      entityId: notice.id,
      after: {
        taxpayerName: taxpayer.name,
        taxpayerCode: taxpayer.code,
        noticeNumber: notice.number,
        reduction: reduction.toString(),
        previousTotal: currentTotal.toString(),
        newTotal: newTotal.toString(),
        status: "PENDING",
      },
    });

    revalidatePath("/reductions");
    revalidatePath("/reductions/approvals");
    return { ok: true, message: "Demande de reduction envoyee pour validation." };
  }

  const status = amountPaid.gte(newTotal)
    ? "PAID"
    : amountPaid.gt(0)
      ? "PARTIAL"
      : "UNPAID";

  await prisma.notice.update({
    where: { id: notice.id },
    data: {
      totalAmount: newTotal,
      status,
    },
  });

  await prisma.noticeReduction.create({
    data: {
      noticeId: notice.id,
      taxpayerId: taxpayer.id,
      amount: reduction,
      previousTotal: currentTotal,
      newTotal,
      reason: parsed.data.reason,
      createdById: user.id,
      status: "APPROVED",
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  });

  await logAudit({
    action: "NOTICE_REDUCTION_APPLIED",
    entityType: "NOTICE",
    entityId: notice.id,
    after: {
      taxpayerName: taxpayer.name,
      taxpayerCode: taxpayer.code,
      noticeNumber: notice.number,
      previousTotal: currentTotal.toString(),
      newTotal: newTotal.toString(),
      reduction: reduction.toString(),
      status: "APPROVED",
    },
  });

  revalidatePath("/reductions");
  revalidatePath("/taxpayers");
  revalidatePath("/dashboard");

  return { ok: true, message: "Reduction appliquee." };
}

export async function approveReductionRequest(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Acces refuse");
  }

  const reductionId = String(formData.get("id") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!reductionId) throw new Error("Identifiant manquant");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { commune: true },
  });
  if (!user) throw new Error("Session invalide, reconnectez-vous.");
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const reduction = await prisma.noticeReduction.findUnique({
    where: { id: reductionId },
    include: { notice: true, taxpayer: true, createdBy: true },
  });
  if (!reduction || reduction.status !== "PENDING") {
    throw new Error("Demande introuvable ou deja traitee");
  }
  if (reduction.createdBy.supervisorId !== user.id) {
    throw new Error("Acces refuse");
  }
  if (scopedCommune && reduction.taxpayer.commune !== scopedCommune) {
    throw new Error("Acces refuse pour cette commune");
  }

  const notice = reduction.notice;
  const reductionAmount = new Prisma.Decimal(reduction.amount);
  const currentTotal = new Prisma.Decimal(notice.totalAmount);
  const amountPaid = new Prisma.Decimal(notice.amountPaid ?? 0);
  const newTotal = currentTotal.sub(reductionAmount);

  if (newTotal.lt(0)) {
    throw new Error("Reduction trop elevee");
  }
  if (newTotal.lt(amountPaid)) {
    throw new Error("Le montant ne peut pas etre inferieur au montant deja paye");
  }

  const status = amountPaid.gte(newTotal)
    ? "PAID"
    : amountPaid.gt(0)
      ? "PARTIAL"
      : "UNPAID";

  await prisma.$transaction(async (tx) => {
    await tx.notice.update({
      where: { id: notice.id },
      data: {
        totalAmount: newTotal,
        status,
      },
    });

    await tx.noticeReduction.update({
      where: { id: reduction.id },
      data: {
        status: "APPROVED",
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNote,
        previousTotal: currentTotal,
        newTotal,
      },
    });
  });

  await logAudit({
    action: "NOTICE_REDUCTION_APPROVED",
    entityType: "NOTICE",
    entityId: notice.id,
    after: {
      taxpayerName: reduction.taxpayer.name,
      taxpayerCode: reduction.taxpayer.code,
      noticeNumber: notice.number,
      previousTotal: currentTotal.toString(),
      newTotal: newTotal.toString(),
      reduction: reductionAmount.toString(),
      status: "APPROVED",
    },
  });

  revalidatePath("/reductions");
  revalidatePath("/reductions/approvals");
  revalidatePath("/taxpayers");
  revalidatePath("/dashboard");
  return { ok: true, message: "Reduction approuvee." };
}

export async function rejectReductionRequest(formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== "SUPER_ADMIN" && session.role !== "ADMIN")) {
    throw new Error("Acces refuse");
  }

  const reductionId = String(formData.get("id") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!reductionId) throw new Error("Identifiant manquant");

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    include: { commune: true },
  });
  if (!user) throw new Error("Session invalide, reconnectez-vous.");
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const reduction = await prisma.noticeReduction.findUnique({
    where: { id: reductionId },
    include: { taxpayer: true, createdBy: true, notice: true },
  });
  if (!reduction || reduction.status !== "PENDING") {
    throw new Error("Demande introuvable ou deja traitee");
  }
  if (reduction.createdBy.supervisorId !== user.id) {
    throw new Error("Acces refuse");
  }
  if (scopedCommune && reduction.taxpayer.commune !== scopedCommune) {
    throw new Error("Acces refuse pour cette commune");
  }

  await prisma.noticeReduction.update({
    where: { id: reduction.id },
    data: {
      status: "REJECTED",
      reviewedById: user.id,
      reviewedAt: new Date(),
      reviewNote,
    },
  });

  await logAudit({
    action: "NOTICE_REDUCTION_REJECTED",
    entityType: "NOTICE",
    entityId: reduction.noticeId,
    after: {
      taxpayerName: reduction.taxpayer.name,
      taxpayerCode: reduction.taxpayer.code,
      noticeNumber: reduction.notice?.number ?? null,
      reduction: reduction.amount?.toString?.() ?? null,
      status: "REJECTED",
      reviewNote,
    },
  });

  revalidatePath("/reductions");
  revalidatePath("/reductions/approvals");
  return { ok: true, message: "Demande rejetee." };
}
