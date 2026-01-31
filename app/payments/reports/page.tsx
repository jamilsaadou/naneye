import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

type ReportsSearchParams = {
  start?: string;
  end?: string;
};

function parseRange(params: ReportsSearchParams) {
  const start = params.start ? new Date(params.start) : null;
  const end = params.end ? new Date(params.end) : null;
  const startValid = start && !Number.isNaN(start.getTime()) ? start : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;
  return { start: startValid, end: endValid };
}

export default async function PaymentsReportsPage({
  searchParams,
}: {
  searchParams?: Promise<ReportsSearchParams>;
}) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const params = (await searchParams) ?? {};
  const range = parseRange(params);
  const paidAtFilter =
    range.start || range.end
      ? {
          paidAt: {
            ...(range.start ? { gte: range.start } : {}),
            ...(range.end ? { lte: range.end } : {}),
          },
        }
      : {};

  const [total, byMethod, lastPayments] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        createdById: user.id,
        ...paidAtFilter,
        ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
      },
    }),
    prisma.payment.groupBy({
      by: ["method"],
      _sum: { amount: true },
      _count: { _all: true },
      where: {
        createdById: user.id,
        ...paidAtFilter,
        ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
      },
    }),
    prisma.payment.findMany({
      where: {
        createdById: user.id,
        ...paidAtFilter,
        ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
      },
      include: { notice: { select: { number: true } } },
      orderBy: { paidAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mon rapport</h1>
        <p className="text-sm text-muted-foreground">Synthese de vos encaissements.</p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Periode</h2>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-3" method="get">
            <label className="text-sm font-medium text-slate-900">
              Du
              <input
                type="date"
                name="start"
                defaultValue={params.start ?? ""}
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Au
              <input
                type="date"
                name="end"
                defaultValue={params.end ?? ""}
                className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              />
            </label>
            <div className="flex items-end gap-2">
              <button type="submit" className="h-9 rounded-md border border-border bg-white px-3 text-sm">
                Filtrer
              </button>
              <a
                className="h-9 rounded-md bg-slate-900 px-3 text-sm text-white"
                href={`/api/payments/export?start=${encodeURIComponent(params.start ?? "")}&end=${encodeURIComponent(
                  params.end ?? "",
                )}`}
              >
                Export Excel
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Total encaissé</p>
            <p className="text-2xl font-semibold">{formatMoney(Number(total._sum.amount ?? 0))}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Nombre d&apos;encaissements</p>
            <p className="text-2xl font-semibold">{formatNumber(total._count._all ?? 0)}</p>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <p className="text-sm text-muted-foreground">Moyenne</p>
            <p className="text-2xl font-semibold">
              {formatMoney(
                total._count._all ? Number(total._sum.amount ?? 0) / total._count._all : 0,
              )}
            </p>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Repartition par mode</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-slate-700">
            {byMethod.map((row) => (
              <div key={row.method} className="flex flex-wrap items-center justify-between gap-3">
                <span>{row.method}</span>
                <span>
                  {formatMoney(Number(row._sum.amount ?? 0))} · {formatNumber(row._count._all)}
                </span>
              </div>
            ))}
            {byMethod.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucune donnée.</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Derniers encaissements</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-slate-700">
            {lastPayments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3">
                <span>{payment.notice.number}</span>
                <span>{new Date(payment.paidAt).toLocaleString("fr-FR")}</span>
                <span>{formatMoney(Number(payment.amount))}</span>
              </div>
            ))}
            {lastPayments.length === 0 && (
              <div className="text-sm text-muted-foreground">Aucun encaissement.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
