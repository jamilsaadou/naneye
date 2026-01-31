import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateNoticeForTaxpayer } from "@/lib/tax-calculation";
import { getSession, getUserWithCommune } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { resolveBulkFilters } from "@/lib/bulk-notice";
import { assertCsrfHeader } from "@/lib/csrf";

export async function POST(request: Request) {
  try {
    await assertCsrfHeader(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Token CSRF invalide.";
    return NextResponse.json({ ok: false, message }, { status: 403 });
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserWithCommune();
  if (!user) {
    return NextResponse.json({ ok: false, message: "Session invalide" }, { status: 401 });
  }

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!payload) {
    return NextResponse.json({ ok: false, message: "Payload invalide." }, { status: 400 });
  }

  const yearValue = typeof payload.year === "string" || typeof payload.year === "number" ? String(payload.year) : "";
  const year = Number.parseInt(yearValue, 10);
  if (!year || Number.isNaN(year)) {
    return NextResponse.json({ ok: false, message: "Année invalide." }, { status: 400 });
  }

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  let filters;
  try {
    filters = resolveBulkFilters(
      {
        scope: typeof payload.scope === "string" ? payload.scope : null,
        category: typeof payload.category === "string" ? payload.category : null,
        commune: typeof payload.commune === "string" ? payload.commune : null,
        neighborhood: typeof payload.neighborhood === "string" ? payload.neighborhood : null,
        groupId: typeof payload.groupId === "string" ? payload.groupId : null,
        startedFrom: typeof payload.startedFrom === "string" ? payload.startedFrom : null,
        startedTo: typeof payload.startedTo === "string" ? payload.startedTo : null,
      },
      scopedCommune,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Filtres invalides.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const taxpayers = await prisma.taxpayer.findMany({
    where: filters.where,
    select: { id: true, name: true },
  });

  const missingStartedAt = filters.missingStartedAtWhere
    ? await prisma.taxpayer.count({ where: filters.missingStartedAtWhere })
    : 0;

  if (taxpayers.length === 0) {
    return NextResponse.json({
      ok: false,
      message: "Aucun contribuable ne correspond aux filtres.",
      matched: 0,
      generated: 0,
      existing: 0,
      failed: 0,
      skippedMissingStartedAt: missingStartedAt,
    });
  }

  const taxpayerIds = taxpayers.map((taxpayer) => taxpayer.id);
  const existingNotices = await prisma.notice.findMany({
    where: { taxpayerId: { in: taxpayerIds }, year },
    select: { taxpayerId: true },
  });
  const existingSet = new Set(existingNotices.map((notice) => notice.taxpayerId));

  let generated = 0;
  let failed = 0;
  const errors: Array<{ name: string; message: string }> = [];

  for (const taxpayer of taxpayers) {
    if (existingSet.has(taxpayer.id)) continue;
    try {
      await calculateNoticeForTaxpayer(taxpayer.id, year);
      generated += 1;
    } catch (error) {
      failed += 1;
      if (errors.length < 5) {
        const message = error instanceof Error ? error.message : "Erreur inconnue";
        errors.push({ name: taxpayer.name, message });
      }
    }
  }

  const existing = existingSet.size;

  await logAudit({
    action: "BULK_NOTICE_CALCULATED",
    entityType: "SYSTEM",
    entityId: "BULK_NOTICE",
    after: {
      year,
      scope: filters.scope,
      category: filters.category,
      commune: filters.commune,
      neighborhood: filters.neighborhood,
      groupId: filters.groupId ?? null,
      startedFrom: payload.startedFrom ?? null,
      startedTo: payload.startedTo ?? null,
      matched: taxpayers.length,
      generated,
      existing,
      failed,
      skippedMissingStartedAt: missingStartedAt,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "Génération groupée terminée.",
    year,
    matched: taxpayers.length,
    generated,
    existing,
    failed,
    skippedMissingStartedAt: missingStartedAt,
    errors,
  });
}
