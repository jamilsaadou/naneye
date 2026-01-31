import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

type HistorySearchParams = {
  start?: string;
  end?: string;
};

function parseRange(params: HistorySearchParams) {
  const start = params.start ? new Date(params.start) : null;
  const end = params.end ? new Date(params.end) : null;
  const startValid = start && !Number.isNaN(start.getTime()) ? start : null;
  const endValid = end && !Number.isNaN(end.getTime()) ? end : null;
  return { start: startValid, end: endValid };
}

export default async function PaymentsHistoryPage({
  searchParams,
}: {
  searchParams?: HistorySearchParams | Promise<HistorySearchParams>;
}) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const params = (await Promise.resolve(searchParams)) ?? {};
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

  const payments = await prisma.payment.findMany({
    where: {
      createdById: user.id,
      ...paidAtFilter,
      ...(scopedCommune ? { notice: { taxpayer: { commune: scopedCommune } } } : {}),
    },
    include: { collector: true, notice: { include: { taxpayer: true } } },
    orderBy: { paidAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mes encaissements</h1>
        <p className="text-sm text-muted-foreground">Historique des encaissements manuels.</p>
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Historique</h2>
        </CardHeader>
        <CardContent>
          <form className="mb-4 grid gap-3 md:grid-cols-3" method="get">
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contribuable</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Methode</TableHead>
                <TableHead>Collecteur</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{new Date(payment.paidAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>{payment.notice.taxpayer.name}</TableCell>
                  <TableCell>{payment.notice.taxpayer.commune}</TableCell>
                  <TableCell>{payment.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(payment.amount))}</TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell>{payment.collector?.name ?? "Interne"}</TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun encaissement.
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
