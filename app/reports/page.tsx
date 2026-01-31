import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarRange, Clock3, Coins, Download, Filter, MapPin, Tag, Users } from "lucide-react";

const STATUS_ORDER = ["UNPAID", "PARTIAL", "PAID"] as const;
const STATUS_LABELS: Record<(typeof STATUS_ORDER)[number], string> = {
  UNPAID: "Impayé",
  PARTIAL: "Paiement partiel",
  PAID: "Payé",
};
const STATUS_COLORS: Record<(typeof STATUS_ORDER)[number], string> = {
  UNPAID: "#ef4444",
  PARTIAL: "#f59e0b",
  PAID: "#16a34a",
};
const CATEGORY_COLORS = [
  "#10b981",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#eab308",
  "#6366f1",
];
const STATUS_BADGE_CLASS: Record<(typeof STATUS_ORDER)[number], string> = {
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-amber-100 text-amber-700",
  PAID: "bg-emerald-100 text-emerald-700",
};

type ReportsSearchParams = {
  start?: string;
  end?: string;
  groupId?: string;
  category?: string;
  commune?: string;
  neighborhood?: string;
  minTotal?: string;
  maxTotal?: string;
  minPaid?: string;
  maxPaid?: string;
};

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

function parseDate(value?: string, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

function parseAmount(value?: string | null) {
  if (!value) return null;
  const normalized = value.replace(/,/g, ".");
  const amount = Number.parseFloat(normalized);
  if (Number.isNaN(amount)) return null;
  return amount;
}

function buildTopList(map: Map<string, number>, limit = 8) {
  const entries = Array.from(map.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  if (entries.length <= limit) return entries;
  const top = entries.slice(0, limit);
  const rest = entries.slice(limit);
  const othersTotal = rest.reduce((sum, item) => sum + item.value, 0);
  if (othersTotal > 0) {
    top.push({ label: "Autres", value: othersTotal });
  }
  return top;
}

function buildPieSegments(values: Array<{ value: number; color: string }>) {
  const total = values.reduce((sum, item) => sum + item.value, 0) || 1;
  let offset = 25;
  return values.map((item) => {
    const percent = item.value / total;
    const length = percent * 100;
    const segment = {
      color: item.color,
      length,
      offset,
    };
    offset -= length;
    return segment;
  });
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }

  const params = (await Promise.resolve(searchParams)) ?? {};
  const start = parseDate(params.start);
  const end = parseDate(params.end, true);
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const groupId = params.groupId ?? "";
  const category = params.category ?? "";
  const selectedCommune = scopedCommune ?? params.commune ?? "";
  const neighborhood = params.neighborhood ?? "";
  const minTotal = parseAmount(params.minTotal);
  const maxTotal = parseAmount(params.maxTotal);
  const minPaid = parseAmount(params.minPaid);
  const maxPaid = parseAmount(params.maxPaid);

  const [groups, communes, neighborhoods, categories] = await Promise.all([
    prisma.taxpayerGroup.findMany({
      where: scopedCommune
        ? { OR: [{ isGlobal: true }, { communes: { some: { name: scopedCommune } } }] }
        : undefined,
      orderBy: { name: "asc" },
      include: { communes: { select: { name: true } } },
    }),
    prisma.commune.findMany({
      orderBy: { name: "asc" },
      ...(scopedCommune ? { where: { name: scopedCommune } } : {}),
    }),
    selectedCommune
      ? prisma.neighborhood.findMany({
          select: { id: true, name: true, commune: { select: { name: true } } },
          orderBy: { name: "asc" },
          where: { commune: { name: selectedCommune } },
        })
      : Promise.resolve([] as Array<{ id: string; name: string; commune: { name: string } }>),
    prisma.taxpayerCategory.findMany({
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
  ]);

  const createdAtFilter =
    start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {};

  const amountFilter = {
    ...(minTotal !== null || maxTotal !== null
      ? {
          totalAmount: {
            ...(minTotal !== null ? { gte: minTotal } : {}),
            ...(maxTotal !== null ? { lte: maxTotal } : {}),
          },
        }
      : {}),
    ...(minPaid !== null || maxPaid !== null
      ? {
          amountPaid: {
            ...(minPaid !== null ? { gte: minPaid } : {}),
            ...(maxPaid !== null ? { lte: maxPaid } : {}),
          },
        }
      : {}),
  };

  const taxpayerFilter = {
    ...(selectedCommune ? { commune: selectedCommune } : {}),
    ...(neighborhood ? { neighborhood } : {}),
    ...(category ? { category } : {}),
    ...(groupId ? { groupId } : {}),
  };
  const noticeScope = {
    ...(createdAtFilter ?? {}),
    ...(amountFilter ?? {}),
    ...(Object.keys(taxpayerFilter).length > 0 ? { taxpayer: taxpayerFilter } : {}),
  };

  const paymentWhere = {
    ...(start || end
      ? {
          paidAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
    ...(Object.keys(taxpayerFilter).length > 0 ? { notice: { taxpayer: taxpayerFilter } } : {}),
  };

  const payments = await prisma.payment.findMany({
    where: paymentWhere,
    include: { collector: true, notice: { include: { taxpayer: true } } },
    orderBy: { paidAt: "desc" },
  });

  const amountByCategory = new Map<string, number>();
  const amountByCommune = new Map<string, number>();
  const amountByCollector = new Map<string, number>();
  const hourlyPayments = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, total: 0 }));

  for (const payment of payments) {
    const amount = Number(payment.amount);
    const categoryLabel = payment.notice.taxpayer.category ?? "Sans catégorie";
    const communeLabel = payment.notice.taxpayer.commune ?? "Commune inconnue";
    const collectorLabel = payment.collector?.name ?? "Interne";
    const hour = payment.paidAt.getHours();

    amountByCategory.set(categoryLabel, (amountByCategory.get(categoryLabel) ?? 0) + amount);
    amountByCommune.set(communeLabel, (amountByCommune.get(communeLabel) ?? 0) + amount);
    amountByCollector.set(collectorLabel, (amountByCollector.get(collectorLabel) ?? 0) + amount);
    hourlyPayments[hour].count += 1;
    hourlyPayments[hour].total += amount;
  }

  const categoryTotals = buildTopList(amountByCategory);
  const communeTotals = buildTopList(amountByCommune);
  const collectorTotals = buildTopList(amountByCollector);
  const maxCategoryTotal = Math.max(1, ...categoryTotals.map((item) => item.value));
  const maxCommuneTotal = Math.max(1, ...communeTotals.map((item) => item.value));
  const maxCollectorTotal = Math.max(1, ...collectorTotals.map((item) => item.value));
  const maxHourlyCount = Math.max(1, ...hourlyPayments.map((item) => item.count));
  const categoryPieSegments = buildPieSegments(
    categoryTotals.map((item, index) => ({
      value: item.value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    })),
  );

  const [totals, statusGroups] = await Promise.all([
    prisma.notice.aggregate({
      _sum: { totalAmount: true, amountPaid: true },
      _count: { _all: true },
      where: noticeScope,
    }),
    prisma.notice.groupBy({
      by: ["status"],
      _count: { _all: true },
      _sum: { totalAmount: true, amountPaid: true },
      where: noticeScope,
    }),
  ]);

  const statusMap = new Map(statusGroups.map((row) => [row.status, row]));
  const statusRows = STATUS_ORDER.map((status) => {
    const row = statusMap.get(status);
    const total = Number(row?._sum.totalAmount ?? 0);
    const paid = Number(row?._sum.amountPaid ?? 0);
    return {
      status,
      label: STATUS_LABELS[status],
      count: row?._count._all ?? 0,
      total,
      paid,
      outstanding: total - paid,
    };
  });

  const totalExpected = Number(totals._sum.totalAmount ?? 0);
  const totalPaid = Number(totals._sum.amountPaid ?? 0);
  const totalOutstanding = totalExpected - totalPaid;
  const recoveryRate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;
  const maxStatusTotal = Math.max(1, ...statusRows.map((row) => row.total));
  const statusTotal = statusRows.reduce((sum, row) => sum + row.count, 0);

  const pieSegments = buildPieSegments([
    { value: statusMap.get("PAID")?._count._all ?? 0, color: STATUS_COLORS.PAID },
    { value: statusMap.get("PARTIAL")?._count._all ?? 0, color: STATUS_COLORS.PARTIAL },
    { value: statusMap.get("UNPAID")?._count._all ?? 0, color: STATUS_COLORS.UNPAID },
  ]);

  const startParam = encodeURIComponent(params.start ?? "");
  const endParam = encodeURIComponent(params.end ?? "");
  const groupParam = encodeURIComponent(groupId);
  const categoryParam = encodeURIComponent(category);
  const communeParam = encodeURIComponent(selectedCommune);
  const neighborhoodParam = encodeURIComponent(neighborhood);
  const minTotalParam = encodeURIComponent(params.minTotal ?? "");
  const maxTotalParam = encodeURIComponent(params.maxTotal ?? "");
  const minPaidParam = encodeURIComponent(params.minPaid ?? "");
  const maxPaidParam = encodeURIComponent(params.maxPaid ?? "");
  const exportQuery = `start=${startParam}&end=${endParam}&groupId=${groupParam}&category=${categoryParam}&commune=${communeParam}&neighborhood=${neighborhoodParam}&minTotal=${minTotalParam}&maxTotal=${maxTotalParam}&minPaid=${minPaidParam}&maxPaid=${maxPaidParam}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Rapports des avis d&apos;imposition</h1>
          <p className="text-sm text-muted-foreground">
            Suivi des impayés, paiements partiels et avis réglés.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Période, filtres & exports</h2>
        </CardHeader>
        <CardContent>
          <form className="space-y-8" method="get">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <CalendarRange className="h-4 w-4 text-slate-500" />
                Période
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">
                  Du
                  <input
                    type="date"
                    name="start"
                    defaultValue={params.start ?? ""}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Au
                  <input
                    type="date"
                    name="end"
                    defaultValue={params.end ?? ""}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MapPin className="h-4 w-4 text-slate-500" />
                Zone & catégorie
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-slate-500" />
                    Catégorie
                  </span>
                  <select
                    name="category"
                    defaultValue={category}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    <option value="">Toutes les catégories</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.label}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Commune
                  <select
                    name="commune"
                    defaultValue={selectedCommune}
                    disabled={Boolean(scopedCommune)}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">Toutes les communes</option>
                    {communes.map((commune) => (
                      <option key={commune.id} value={commune.name}>
                        {commune.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Quartier
                  <select
                    name="neighborhood"
                    defaultValue={neighborhood}
                    disabled={!selectedCommune}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="">
                      {selectedCommune ? "Tous les quartiers" : "Choisir une commune d'abord"}
                    </option>
                    {neighborhoods.map((item) => (
                      <option key={item.id} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    Groupe
                  </span>
                  <select
                    name="groupId"
                    defaultValue={groupId}
                    className="mt-2 h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  >
                    <option value="">Tous les groupes</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                        {group.isGlobal
                          ? " · Toutes communes"
                          : !scopedCommune
                            ? ` · ${group.communes.map((item) => item.name).join(", ")}`
                            : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Coins className="h-4 w-4 text-slate-500" />
                Montants
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs font-medium text-slate-700">
                  Montant total (min / max)
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <input
                      type="number"
                      name="minTotal"
                      defaultValue={params.minTotal ?? ""}
                      placeholder="Min"
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    />
                    <input
                      type="number"
                      name="maxTotal"
                      defaultValue={params.maxTotal ?? ""}
                      placeholder="Max"
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    />
                  </div>
                </label>
                <label className="text-xs font-medium text-slate-700">
                  Montant payé (min / max)
                  <div className="mt-2 grid gap-3 md:grid-cols-2">
                    <input
                      type="number"
                      name="minPaid"
                      defaultValue={params.minPaid ?? ""}
                      placeholder="Min"
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    />
                    <input
                      type="number"
                      name="maxPaid"
                      defaultValue={params.maxPaid ?? ""}
                      placeholder="Max"
                      className="h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                    />
                  </div>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Filter className="h-4 w-4 text-slate-500" />
                Actions rapides
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="submit" className="h-10 rounded-md border border-border bg-white px-4 text-sm">
                  Filtrer
                </button>
                <a
                  className="flex h-10 items-center justify-center rounded-md bg-slate-900 px-4 text-sm text-white"
                  href={`/api/reports/notices/export?${exportQuery}&status=ALL`}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export global
                </a>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Les exports respectent les filtres sélectionnés.
              </p>
            </div>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <a
              className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-red-700"
              href={`/api/reports/notices/export?${exportQuery}&status=UNPAID`}
            >
              Export impayés
            </a>
            <a
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700"
              href={`/api/reports/notices/export?${exportQuery}&status=PARTIAL`}
            >
              Export paiements partiels
            </a>
            <a
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-emerald-700"
              href={`/api/reports/notices/export?${exportQuery}&status=PAID`}
            >
              Export payés
            </a>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Avis concernés</p>
            <p className="text-2xl font-semibold">{formatNumber(totals._count._all ?? 0)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Montant total</p>
            <p className="text-2xl font-semibold">{formatMoney(totalExpected)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Montant encaissé</p>
            <p className="text-2xl font-semibold">{formatMoney(totalPaid)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Reste à payer</p>
            <p className="text-2xl font-semibold">{formatMoney(totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">Taux de recouvrement: {recoveryRate}%</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Répartition des avis</p>
            <p className="text-lg font-semibold">Statut global</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative h-32 w-32">
                <svg viewBox="0 0 36 36" className="h-32 w-32">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  {pieSegments.map((segment) => (
                    <circle
                      key={segment.color}
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="4"
                      strokeDasharray={`${segment.length} ${100 - segment.length}`}
                      strokeDashoffset={segment.offset}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
              </div>
              <div className="space-y-3 text-sm">
                {statusRows.map((row) => (
                  <div key={row.status} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-slate-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[row.status] }}
                      />
                      {row.label}
                    </span>
                    <span className="font-semibold text-slate-900">{formatNumber(row.count)}</span>
                  </div>
                ))}
                <div className="text-xs text-muted-foreground">Total: {formatNumber(statusTotal)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Montants par statut</p>
            <p className="text-lg font-semibold">Total, encaissé, restant</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {statusRows.map((row) => {
                const totalRatio = row.total > 0 ? row.total / maxStatusTotal : 0;
                const paidRatio = row.total > 0 ? row.paid / row.total : 0;
                const outstandingRatio = row.total > 0 ? row.outstanding / row.total : 0;
                return (
                  <div key={row.status} className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="font-medium text-slate-900">{row.label}</span>
                      <span className="text-slate-600">
                        {formatMoney(row.total)} · {formatNumber(row.count)} avis
                      </span>
                    </div>
                    <div className="h-3 w-full rounded-full bg-slate-100">
                      <div
                        className="flex h-3 overflow-hidden rounded-full"
                        style={{ width: `${totalRatio * 100}%` }}
                      >
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${paidRatio * 100}%` }}
                        />
                        <div
                          className="h-full bg-red-500"
                          style={{ width: `${outstandingRatio * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span>Encaissé: {formatMoney(row.paid)}</span>
                      <span>Reste: {formatMoney(row.outstanding)}</span>
                    </div>
                  </div>
                );
              })}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-full bg-emerald-500" />
                  Encaissé
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-full bg-red-500" />
                  Reste à payer
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Répartition des montants encaissés</h2>
          <p className="text-sm text-muted-foreground">Par catégorie, commune et collecteur de paiement.</p>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
              Aucun paiement sur la période sélectionnée.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Par catégorie</div>
                <div className="mt-3 space-y-3">
                  {categoryTotals.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-medium text-slate-900">{formatMoney(item.value)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${(item.value / maxCategoryTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Par commune</div>
                <div className="mt-3 space-y-3">
                  {communeTotals.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-medium text-slate-900">{formatMoney(item.value)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-sky-500"
                          style={{ width: `${(item.value / maxCommuneTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Par collecteur</div>
                <div className="mt-3 space-y-3">
                  {collectorTotals.map((item) => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-700">{item.label}</span>
                        <span className="font-medium text-slate-900">{formatMoney(item.value)}</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-amber-500"
                          style={{ width: `${(item.value / maxCollectorTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Disque de répartition par catégorie</h2>
          <p className="text-sm text-muted-foreground">Vue globale des montants encaissés par catégorie.</p>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
              Aucun paiement sur la période sélectionnée.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-6">
              <div className="relative h-36 w-36">
                <svg viewBox="0 0 36 36" className="h-36 w-36">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                  {categoryPieSegments.map((segment, index) => (
                    <circle
                      key={`${segment.color}-${index}`}
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke={segment.color}
                      strokeWidth="4"
                      strokeDasharray={`${segment.length} ${100 - segment.length}`}
                      strokeDashoffset={segment.offset}
                      strokeLinecap="round"
                    />
                  ))}
                </svg>
              </div>
              <div className="space-y-3 text-sm">
                {categoryTotals.map((item, index) => (
                  <div key={item.label} className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2 text-slate-700">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
                      />
                      {item.label}
                    </span>
                    <span className="font-semibold text-slate-900">{formatMoney(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Fréquence horaire des paiements</h2>
          <p className="text-sm text-muted-foreground">Nombre de paiements enregistrés par heure.</p>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-muted-foreground">
              Aucun paiement sur la période sélectionnée.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock3 className="h-4 w-4" />
                {formatNumber(payments.length)} paiements
              </div>
              <div className="flex items-end gap-1 rounded-xl border border-slate-200 bg-white p-4">
                {hourlyPayments.map((item) => {
                  const height = Math.max(6, Math.round((item.count / maxHourlyCount) * 120));
                  const showLabel = item.hour % 3 === 0;
                  return (
                    <div key={item.hour} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-2 rounded-full bg-slate-400/80"
                        style={{ height }}
                        title={`${item.hour}h · ${item.count} paiements`}
                      />
                      <span className="text-[10px] text-slate-500">{showLabel ? `${item.hour}h` : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Synthèse détaillée</h2>
          <p className="text-sm text-muted-foreground">Vue consolidée par statut.</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Statut</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Montant total</TableHead>
                <TableHead>Encaissé</TableHead>
                <TableHead>Reste à payer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusRows.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>
                    <Badge className={STATUS_BADGE_CLASS[row.status]}>{row.label}</Badge>
                  </TableCell>
                  <TableCell>{formatNumber(row.count)}</TableCell>
                  <TableCell>{formatMoney(row.total)}</TableCell>
                  <TableCell>{formatMoney(row.paid)}</TableCell>
                  <TableCell>{formatMoney(row.outstanding)}</TableCell>
                </TableRow>
              ))}
              {statusRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune donnée disponible.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
