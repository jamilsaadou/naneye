import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { applyNoticeReduction } from "./actions";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

function statusBadge(status: string) {
  if (status === "APPROVED") return { label: "Approuvee", className: "bg-emerald-100 text-emerald-800" };
  if (status === "REJECTED") return { label: "Rejetee", className: "bg-rose-100 text-rose-800" };
  return { label: "En attente", className: "bg-amber-100 text-amber-800" };
}

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(params: SearchParams | undefined, key: string) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}

export default async function ReductionsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }
  const requiresApproval = Boolean(user.supervisorId);

  const statusParam = (getParam(searchParams, "status") ?? "all").toLowerCase();
  const pageSizeParam = Number.parseInt(getParam(searchParams, "pageSize") ?? "10", 10);
  const pageSize = [10, 50, 100].includes(pageSizeParam) ? pageSizeParam : 10;
  const page = Math.max(1, Number.parseInt(getParam(searchParams, "page") ?? "1", 10) || 1);
  const fromDate = parseDate(getParam(searchParams, "from"));
  const toDate = parseDate(getParam(searchParams, "to"), true);
  const taxpayerCode = getParam(searchParams, "taxpayerCode")?.trim();
  const taxpayerPhone = getParam(searchParams, "taxpayerPhone")?.trim();
  const noticeNumber = getParam(searchParams, "noticeNumber")?.trim();

  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  let statusFilter: Prisma.NoticeReductionWhereInput | undefined;
  if (statusParam === "pending") statusFilter = { status: "PENDING" };
  if (statusParam === "approved") statusFilter = { status: "APPROVED" };
  if (statusParam === "rejected") statusFilter = { status: "REJECTED" };
  if (statusParam === "processed") statusFilter = { status: { in: ["APPROVED", "REJECTED"] } };

  const where: Prisma.NoticeReductionWhereInput = {
    createdById: user.id,
    ...(statusFilter ?? {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(taxpayerCode || taxpayerPhone
      ? {
          taxpayer: {
            ...(taxpayerCode
              ? {
                  code: { contains: taxpayerCode, mode: "insensitive" },
                }
              : {}),
            ...(taxpayerPhone
              ? {
                  phone: { contains: taxpayerPhone, mode: "insensitive" },
                }
              : {}),
          },
        }
      : {}),
    ...(noticeNumber
      ? {
          notice: { number: { contains: noticeNumber, mode: "insensitive" } },
        }
      : {}),
  };

  const [total, reductions] = await prisma.$transaction([
    prisma.noticeReduction.count({ where }),
    prisma.noticeReduction.findMany({
      where,
      include: {
        notice: true,
        taxpayer: true,
        reviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const params = new URLSearchParams();
  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    const entry = Array.isArray(value) ? value[0] : value;
    if (entry) params.set(key, entry);
  });
  const pageHref = (nextPage: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(nextPage));
    return `?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Reductions</h1>
        <p className="text-sm text-muted-foreground">
          {requiresApproval
            ? "Soumettre une demande de reduction pour validation."
            : "Appliquer une reduction a une facture fiscale en preservant les montants payes."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Filtres</h2>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-6">
            <input type="hidden" name="page" value="1" />
            <select
              name="status"
              defaultValue={statusParam}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvees</option>
              <option value="rejected">Rejetees</option>
              <option value="processed">Traitees</option>
            </select>
            <Input name="taxpayerCode" placeholder="Code contribuable" defaultValue={taxpayerCode ?? ""} />
            <Input name="taxpayerPhone" placeholder="Telephone contribuable" defaultValue={taxpayerPhone ?? ""} />
            <Input name="noticeNumber" placeholder="Numero d'avis" defaultValue={noticeNumber ?? ""} />
            <Input name="from" type="date" defaultValue={getParam(searchParams, "from") ?? ""} />
            <Input name="to" type="date" defaultValue={getParam(searchParams, "to") ?? ""} />
            <select
              name="pageSize"
              defaultValue={String(pageSize)}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="10">10 / page</option>
              <option value="50">50 / page</option>
              <option value="100">100 / page</option>
            </select>
            <div className="md:col-span-5 flex items-center gap-2">
              <Button type="submit">Filtrer</Button>
              <Button asChild variant="outline">
                <a href="/reductions">Reinitialiser</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{requiresApproval ? "Demander une reduction" : "Appliquer une reduction"}</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={applyNoticeReduction}
            className="grid gap-4 md:grid-cols-4"
            successMessage={requiresApproval ? "Demande envoyee." : "Reduction appliquee."}
          >
            <label className="text-sm font-medium text-slate-900">
              Code contribuable
              <Input name="taxpayerCode" placeholder="Ex: 10-C1-00023" required className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Numero d&apos;avis
              <Input name="noticeNumber" placeholder="Ex: T1-25-820565" required className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Montant de reduction
              <Input name="amount" type="number" min="0" step="0.01" required className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900 md:col-span-4">
              Motif
              <Input name="reason" placeholder="Motif de la reduction" required className="mt-2" />
            </label>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit">{requiresApproval ? "Envoyer la demande" : "Appliquer"}</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Mes demandes</h2>
            <span className="text-sm text-muted-foreground">{formatNumber(total)} enregistrements</span>
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
                <TableHead>Avant</TableHead>
                <TableHead>Apres</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Motif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reductions.map((reduction) => (
                <TableRow key={reduction.id}>
                  <TableCell>{new Date(reduction.createdAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{reduction.taxpayer.name}</div>
                    <div className="text-xs text-slate-500">{reduction.taxpayer.code ?? "-"}</div>
                  </TableCell>
                  <TableCell>{reduction.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(reduction.amount))}</TableCell>
                  <TableCell>{formatMoney(Number(reduction.previousTotal))}</TableCell>
                  <TableCell>{formatMoney(Number(reduction.newTotal))}</TableCell>
                  <TableCell>
                    {(() => {
                      const badge = statusBadge(reduction.status);
                      return (
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                          {badge.label}
                        </span>
                      );
                    })()}
                  </TableCell>
                  <TableCell>{reduction.reason ?? "-"}</TableCell>
                </TableRow>
              ))}
              {reductions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune demande enregistree.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} sur {totalPages}
            </span>
            <div className="flex gap-2">
              {page <= 1 ? (
                <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-sm opacity-50">
                  Precedent
                </span>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={pageHref(page - 1)}>Precedent</a>
                </Button>
              )}
              {page >= totalPages ? (
                <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-sm opacity-50">
                  Suivant
                </span>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <a href={pageHref(page + 1)}>Suivant</a>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
