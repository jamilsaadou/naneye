import type { Prisma } from "@prisma/client";

export type BulkNoticeScope = "GLOBAL" | "COMMUNE" | "NEIGHBORHOOD";

export type BulkNoticeFilters = {
  scope?: string | null;
  category?: string | null;
  commune?: string | null;
  neighborhood?: string | null;
  groupId?: string | null;
  startedFrom?: string | null;
  startedTo?: string | null;
};

function normalizeString(value?: string | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeScope(value?: string | null): BulkNoticeScope {
  const normalized = normalizeString(value)?.toUpperCase() ?? "GLOBAL";
  if (normalized === "COMMUNE") return "COMMUNE";
  if (normalized === "NEIGHBORHOOD") return "NEIGHBORHOOD";
  return "GLOBAL";
}

export function parseDateInput(value?: string | null, endOfDay = false) {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export function resolveBulkFilters(filters: BulkNoticeFilters, scopedCommune: string | null) {
  const scope = normalizeScope(filters.scope);
  const category = normalizeString(filters.category);
  let commune = normalizeString(filters.commune);
  let neighborhood = normalizeString(filters.neighborhood);
  const groupId = normalizeString(filters.groupId);

  if (scopedCommune) {
    commune = scopedCommune;
  }

  if (scope === "COMMUNE") {
    if (!commune) throw new Error("Commune requise pour ce mode.");
    neighborhood = null;
  }

  if (scope === "NEIGHBORHOOD") {
    if (!commune) throw new Error("Commune requise pour filtrer par quartier.");
    if (!neighborhood) throw new Error("Quartier requis pour ce mode.");
  }

  if (scope === "GLOBAL" && !scopedCommune) {
    commune = null;
    neighborhood = null;
  }

  if (scope !== "NEIGHBORHOOD") {
    neighborhood = null;
  }

  const startedFrom = parseDateInput(filters.startedFrom);
  const startedTo = parseDateInput(filters.startedTo, true);

  const baseWhere: Prisma.TaxpayerWhereInput = {
    status: "ACTIVE",
    ...(category ? { category } : {}),
    ...(commune ? { commune } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const where: Prisma.TaxpayerWhereInput = {
    ...baseWhere,
    ...(startedFrom || startedTo
      ? {
          startedAt: {
            ...(startedFrom ? { gte: startedFrom } : {}),
            ...(startedTo ? { lte: startedTo } : {}),
          },
        }
      : {}),
  };

  const missingStartedAtWhere = startedFrom || startedTo ? { ...baseWhere, startedAt: null } : null;

  return {
    scope,
    category,
    commune,
    neighborhood,
    groupId,
    startedFrom,
    startedTo,
    where,
    missingStartedAtWhere,
  };
}
