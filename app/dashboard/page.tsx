import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
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

type DashboardSearchParams = {
  year?: string;
  commune?: string;
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<DashboardSearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const currentYear = new Date().getFullYear();
  const year = Number.parseInt(params.year ?? "", 10);
  const selectedYear = Number.isNaN(year) ? currentYear : year;
  const startYear = new Date(selectedYear, 0, 1);
  const endYear = new Date(selectedYear + 1, 0, 1);
  const user = await getUserWithCommune();
  const isGlobalAccess = user?.role === "SUPER_ADMIN";
  const selectedCommune =
    isGlobalAccess && params.commune && params.commune !== "all" ? params.commune : null;
  const scopedCommune = isGlobalAccess ? selectedCommune : user?.commune?.name ?? null;
  const scopedNoticeWhere = scopedCommune ? { taxpayer: { commune: scopedCommune } } : undefined;
  const scopedTaxpayerWhere = scopedCommune ? { commune: scopedCommune } : undefined;

  const [communes, taxpayers, notices, payments, totals, statusCounts, noticeTrends, paymentTrends, reductionsSummary, recentReductions] = await Promise.all([
    isGlobalAccess
      ? prisma.commune.findMany({ select: { name: true }, orderBy: { name: "asc" } })
      : Promise.resolve([] as Array<{ name: string }>),
    prisma.taxpayer.count({ where: scopedTaxpayerWhere ?? undefined }),
    prisma.notice.count({
      where: {
        year: selectedYear,
        ...(scopedNoticeWhere ?? {}),
      },
    }),
    prisma.payment.findMany({
      take: 5,
      orderBy: { paidAt: "desc" },
      include: { notice: { include: { taxpayer: true } } },
      where: {
        paidAt: { gte: startYear, lt: endYear },
        ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
      },
    }),
    prisma.notice.aggregate({
      _sum: { totalAmount: true, amountPaid: true },
      where: {
        year: selectedYear,
        ...(scopedNoticeWhere ?? {}),
      },
    }),
    prisma.notice.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: {
        year: selectedYear,
        ...(scopedNoticeWhere ?? {}),
      },
    }),
    prisma.notice.findMany({
      where: {
        year: selectedYear,
        ...(scopedNoticeWhere ?? {}),
      },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.payment.findMany({
      where: {
        paidAt: { gte: startYear, lt: endYear },
        ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
      },
      select: { paidAt: true, amount: true },
    }),
    prisma.noticeReduction.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        status: "APPROVED",
        notice: { year: selectedYear },
        ...(scopedCommune ? { taxpayer: { commune: scopedCommune } } : {}),
      },
    }),
    prisma.noticeReduction.findMany({
      where: {
        status: "APPROVED",
        notice: { year: selectedYear },
        ...(scopedCommune ? { taxpayer: { commune: scopedCommune } } : {}),
      },
      include: { taxpayer: true, notice: true, createdBy: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const [taxpayersByCategory, taxpayersByCommune, noticeTotals, taxDistribution] = await Promise.all([
    prisma.taxpayer.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: scopedTaxpayerWhere ?? undefined,
    }),
    prisma.taxpayer.groupBy({
      by: ["commune"],
      _count: { _all: true },
      where: scopedTaxpayerWhere ?? undefined,
    }),
    prisma.notice.findMany({
      where: {
        year: selectedYear,
        ...(scopedNoticeWhere ?? {}),
      },
      select: {
        totalAmount: true,
        taxpayer: { select: { category: true, commune: true } },
      },
    }),
    prisma.noticeLine.groupBy({
      by: ["taxLabel"],
      _sum: { amount: true },
      where: {
        notice: {
          year: selectedYear,
          ...(scopedNoticeWhere ?? {}),
        },
      },
      orderBy: { _sum: { amount: "desc" } },
    }),
  ]);

  const totalExpected = Number(totals._sum.totalAmount ?? 0);
  const totalPaid = Number(totals._sum.amountPaid ?? 0);
  const recoveryRate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;
  const monthlyData = Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(selectedYear, index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key,
      label: `${MONTH_LABELS[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`,
      expected: 0,
      paid: 0,
    };
  });

  const monthIndex = new Map(monthlyData.map((entry, index) => [entry.key, index]));
  noticeTrends.forEach((notice) => {
    const key = `${notice.createdAt.getFullYear()}-${String(notice.createdAt.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) monthlyData[idx].expected += Number(notice.totalAmount);
  });
  paymentTrends.forEach((payment) => {
    const key = `${payment.paidAt.getFullYear()}-${String(payment.paidAt.getMonth() + 1).padStart(2, "0")}`;
    const idx = monthIndex.get(key);
    if (idx !== undefined) monthlyData[idx].paid += Number(payment.amount);
  });

  const maxTrend = Math.max(
    1,
    ...monthlyData.map((entry) => Math.max(entry.expected, entry.paid)),
  );
  const trendPoints = monthlyData.map((entry, idx) => {
    const x = (idx / (monthlyData.length - 1)) * 100;
    const yExpected = 100 - (entry.expected / maxTrend) * 100;
    const yPaid = 100 - (entry.paid / maxTrend) * 100;
    return { x, yExpected, yPaid };
  });

  const statusTotal = statusCounts.reduce((sum, row) => sum + row._count._all, 0);
  const statusMap = new Map(statusCounts.map((row) => [row.status, row._count._all]));
  const pieSegments = buildPieSegments([
    { value: statusMap.get("PAID") ?? 0, color: "#16a34a" },
    { value: statusMap.get("PARTIAL") ?? 0, color: "#f59e0b" },
    { value: statusMap.get("UNPAID") ?? 0, color: "#ef4444" },
  ]);

  const amountByCategory = new Map<string, number>();
  const amountByCommune = new Map<string, number>();
  noticeTotals.forEach((notice) => {
    const category = notice.taxpayer.category ?? "Sans categorie";
    const commune = notice.taxpayer.commune ?? "Sans commune";
    amountByCategory.set(category, (amountByCategory.get(category) ?? 0) + Number(notice.totalAmount));
    amountByCommune.set(commune, (amountByCommune.get(commune) ?? 0) + Number(notice.totalAmount));
  });

  const categoryRows = taxpayersByCategory
    .map((row) => ({
      label: row.category ?? "Sans categorie",
      count: row._count._all,
      total: amountByCategory.get(row.category ?? "Sans categorie") ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const communeRows = taxpayersByCommune
    .map((row) => ({
      label: row.commune ?? "Sans commune",
      count: row._count._all,
      total: amountByCommune.get(row.commune ?? "Sans commune") ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const maxCategoryCount = Math.max(1, ...categoryRows.map((row) => row.count));
  const maxCategoryTotal = Math.max(1, ...categoryRows.map((row) => row.total));
  const maxCommuneCount = Math.max(1, ...communeRows.map((row) => row.count));
  const maxCommuneTotal = Math.max(1, ...communeRows.map((row) => row.total));

  // Répartition par type de taxe
  const taxColors = ["#16a34a", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#64748b"];
  const taxRows = taxDistribution
    .map((row, index) => ({
      label: row.taxLabel,
      amount: Number(row._sum.amount ?? 0),
      color: taxColors[index % taxColors.length],
    }))
    .filter((row) => row.amount > 0);
  const totalTaxAmount = taxRows.reduce((sum, row) => sum + row.amount, 0);
  const taxPieSegments = buildPieSegments(
    taxRows.map((row) => ({ value: row.amount, color: row.color }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Vue d’ensemble du recouvrement.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            {isGlobalAccess && (
              <select
                name="commune"
                defaultValue={selectedCommune ?? "all"}
                className="h-10 rounded-full border border-border bg-white px-4 text-sm"
              >
                <option value="all">Toutes les communes</option>
                {communes.map((commune) => (
                  <option key={commune.name} value={commune.name}>
                    {commune.name}
                  </option>
                ))}
              </select>
            )}
            <select
              name="year"
              defaultValue={String(selectedYear)}
              className="h-10 rounded-full border border-border bg-white px-4 text-sm"
            >
              {Array.from({ length: currentYear - 2025 + 6 }).map((_, index) => {
                const value = 2025 + index;
                return (
                  <option key={value} value={value}>
                    Exercice {value}
                  </option>
                );
              })}
            </select>
            <Button type="submit" variant="outline">
              Valider
            </Button>
          </form>
          <Button asChild>
            <Link href="/taxpayers/new">+ Créer contribuable</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/assessments/new">+ Générer avis</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/payments/new">+ Encaisser paiement</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Contribuables</p>
            <p className="text-2xl font-semibold">{formatNumber(taxpayers)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Avis générés</p>
            <p className="text-2xl font-semibold">{formatNumber(notices)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Taux de recouvrement</p>
            <p className="text-2xl font-semibold">{recoveryRate}%</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Montant total attendu</p>
            <p className="text-xl font-semibold">{formatMoney(totalExpected)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Montant encaissé</p>
            <p className="text-xl font-semibold">{formatMoney(totalPaid)}</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Reductions accordees</p>
            <p className="text-xl font-semibold">{formatMoney(Number(reductionsSummary._sum.amount ?? 0))}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Nombre de reductions</p>
            <p className="text-xl font-semibold">{formatNumber(reductionsSummary._count._all ?? 0)}</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Statut des avis</p>
            <p className="text-lg font-semibold">Répartition globale</p>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 36 36" className="h-28 w-28">
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="4"
                  />
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
              <div className="flex-1 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Payé
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatNumber(statusMap.get("PAID") ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                    Partiel
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatNumber(statusMap.get("PARTIAL") ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                    Non payé
                  </span>
                  <span className="font-semibold text-slate-900">
                    {formatNumber(statusMap.get("UNPAID") ?? 0)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground pt-1 border-t border-slate-100">Total: {formatNumber(statusTotal)}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Par type de taxe</p>
            <p className="text-lg font-semibold">Répartition des montants</p>
          </CardHeader>
          <CardContent>
            {taxRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune donnée disponible.</div>
            ) : (
              <div className="flex items-center gap-6">
                <div className="relative h-28 w-28 shrink-0">
                  <svg viewBox="0 0 36 36" className="h-28 w-28">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.9155"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="4"
                    />
                    {taxPieSegments.map((segment, idx) => (
                      <circle
                        key={idx}
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
                <div className="flex-1 space-y-1.5 text-sm">
                  {taxRows.slice(0, 5).map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        <span className="truncate max-w-[140px]">{row.label}</span>
                      </span>
                      <span className="font-semibold text-slate-900 whitespace-nowrap">
                        {formatNumber(row.amount)}
                      </span>
                    </div>
                  ))}
                  {taxRows.length > 5 && (
                    <div className="text-xs text-slate-500">+{taxRows.length - 5} autres taxes</div>
                  )}
                  <div className="text-xs text-muted-foreground pt-1 border-t border-slate-100">
                    Total: {formatMoney(totalTaxAmount)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Tendance 12 derniers mois</p>
            <p className="text-lg font-semibold">Avis vs paiements</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="h-56 w-full rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex h-full items-end gap-2">
                  {monthlyData.map((entry) => {
                    const expectedPct = (entry.expected / maxTrend) * 100;
                    const paidPct = (entry.paid / maxTrend) * 100;
                    const expectedHeight = entry.expected > 0 ? Math.max(4, expectedPct) : 0;
                    const paidHeight = entry.paid > 0 ? Math.max(4, paidPct) : 0;
                    return (
                      <div key={entry.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                        <div className="flex h-full w-full items-end gap-1">
                          <div
                            className="w-1/2 rounded-md bg-slate-900/80"
                            style={{ height: `${expectedHeight}%` }}
                            title={`Attendu: ${formatMoney(entry.expected)}`}
                          />
                          <div
                            className="w-1/2 rounded-md bg-emerald-500/80"
                            style={{ height: `${paidHeight}%` }}
                            title={`Encaisse: ${formatMoney(entry.paid)}`}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">{entry.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-full bg-slate-900" />
                  Attendu
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-6 rounded-full bg-emerald-500" />
                  Encaissé
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

      <div className={`grid gap-4 ${scopedCommune ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Répartition par catégorie</p>
            <p className="text-lg font-semibold">Contribuables et montants</p>
          </CardHeader>
          <CardContent>
            {categoryRows.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucune donnée disponible.</div>
            ) : (
              <div className="space-y-4">
                {categoryRows.map((row) => (
                  <div key={row.label} className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="font-medium text-slate-900">{row.label}</div>
                      <div className="flex flex-wrap items-center gap-3 text-slate-600">
                        <span>{formatNumber(row.count)} contribuables</span>
                        <span>{formatMoney(row.total)}</span>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-emerald-500"
                          style={{ width: `${(row.count / maxCategoryCount) * 100}%` }}
                        />
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100">
                        <div
                          className="h-2 rounded-full bg-slate-900"
                          style={{ width: `${(row.total / maxCategoryTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-6 rounded-full bg-emerald-500" />
                    Contribuables
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-6 rounded-full bg-slate-900" />
                    Montant
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!scopedCommune && (
          <Card>
            <CardHeader>
              <p className="text-sm text-muted-foreground">Répartition par commune</p>
              <p className="text-lg font-semibold">Contribuables et montants</p>
            </CardHeader>
            <CardContent>
              {communeRows.length === 0 ? (
                <div className="text-sm text-muted-foreground">Aucune donnée disponible.</div>
              ) : (
                <div className="space-y-4">
                  {communeRows.map((row) => (
                    <div key={row.label} className="space-y-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-medium text-slate-900">{row.label}</div>
                        <div className="flex flex-wrap items-center gap-3 text-slate-600">
                          <span>{formatNumber(row.count)} contribuables</span>
                          <span>{formatMoney(row.total)}</span>
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{ width: `${(row.count / maxCommuneCount) * 100}%` }}
                          />
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-slate-900"
                            style={{ width: `${(row.total / maxCommuneTotal) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-6 rounded-full bg-emerald-500" />
                      Contribuables
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-6 rounded-full bg-slate-900" />
                      Montant
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Derniers paiements</h2>
              <p className="text-sm text-muted-foreground">Les 5 derniers encaissements.</p>
            </div>
            <Button variant="ghost" asChild>
              <Link href="/payments">Voir tout</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribuable</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.notice.taxpayer.name}</TableCell>
                  <TableCell>{payment.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(payment.amount))}</TableCell>
                  <TableCell>
                    <Badge variant={payment.notice.status === "PAID" ? "success" : "warning"}>
                      {payment.notice.status === "PAID" ? "Payé" : "Partiel"}
                    </Badge>
                  </TableCell>
                  <TableCell>{payment.paidAt.toLocaleDateString("fr-FR")}</TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun paiement enregistré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Dernieres reductions</h2>
              <p className="text-sm text-muted-foreground">Les 5 dernieres reductions appliquees.</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contribuable</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Auteur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentReductions.map((reduction) => (
                <TableRow key={reduction.id}>
                  <TableCell>{new Date(reduction.createdAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>{reduction.taxpayer.name}</TableCell>
                  <TableCell>{reduction.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(reduction.amount))}</TableCell>
                  <TableCell>{reduction.createdBy?.name ?? reduction.createdBy?.email ?? "Systeme"}</TableCell>
                </TableRow>
              ))}
              {recentReductions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune reduction enregistree.
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
