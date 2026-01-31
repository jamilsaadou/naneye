import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReductionApprovalActions } from "./approval-actions";

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

export default async function ReductionApprovalsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const statusParam = (getParam(searchParams, "status") ?? "pending").toLowerCase();
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
    createdBy: { supervisorId: user.id },
    ...(statusFilter ?? {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
    ...(scopedCommune ? { taxpayer: { commune: scopedCommune } } : {}),
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

  const [total, reductions, processedByMe] = await prisma.$transaction([
    prisma.noticeReduction.count({ where }),
    prisma.noticeReduction.findMany({
      where,
      include: {
        notice: true,
        taxpayer: true,
        createdBy: true,
        reviewedBy: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.noticeReduction.findMany({
      where: {
        status: { in: ["APPROVED", "REJECTED"] },
        reviewedById: user.id,
        ...(scopedCommune ? { taxpayer: { commune: scopedCommune } } : {}),
      },
      include: {
        notice: true,
        taxpayer: true,
        createdBy: true,
      },
      orderBy: { reviewedAt: "desc" },
      take: 200,
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
        <h1 className="text-2xl font-semibold">Demandes de reduction</h1>
        <p className="text-sm text-muted-foreground">
          Valider ou rejeter les demandes de reduction des utilisateurs supervises.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Demandes</h2>
            <span className="text-sm text-muted-foreground">{formatNumber(total)} demandes</span>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="mb-4 grid gap-3 md:grid-cols-6">
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
            <input
              name="taxpayerCode"
              placeholder="Code contribuable"
              defaultValue={taxpayerCode ?? ""}
              className="h-9 rounded-md border border-border px-3 text-sm"
            />
            <input
              name="taxpayerPhone"
              placeholder="Telephone contribuable"
              defaultValue={taxpayerPhone ?? ""}
              className="h-9 rounded-md border border-border px-3 text-sm"
            />
            <input
              name="noticeNumber"
              placeholder="Numero d'avis"
              defaultValue={noticeNumber ?? ""}
              className="h-9 rounded-md border border-border px-3 text-sm"
            />
            <input
              name="from"
              type="date"
              defaultValue={getParam(searchParams, "from") ?? ""}
              className="h-9 rounded-md border border-border px-3 text-sm"
            />
            <input
              name="to"
              type="date"
              defaultValue={getParam(searchParams, "to") ?? ""}
              className="h-9 rounded-md border border-border px-3 text-sm"
            />
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
              <button type="submit" className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-white">
                Filtrer
              </button>
              <a href="/reductions/approvals" className="h-9 rounded-md border border-border px-4 text-sm leading-9">
                Reinitialiser
              </a>
            </div>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Contribuable</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Demandeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Traitee par</TableHead>
                <TableHead>Actions</TableHead>
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
                  <TableCell>{reduction.createdBy.name ?? reduction.createdBy.email}</TableCell>
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
                  <TableCell>{reduction.reviewedBy?.name ?? reduction.reviewedBy?.email ?? "-"}</TableCell>
                  <TableCell>
                    {reduction.status === "PENDING" ? (
                      <ReductionApprovalActions
                        reductionId={reduction.id}
                        taxpayerName={reduction.taxpayer.name}
                        taxpayerCode={reduction.taxpayer.code ?? "-"}
                        noticeNumber={reduction.notice.number}
                        amountLabel={formatMoney(Number(reduction.amount))}
                        createdBy={reduction.createdBy.name ?? reduction.createdBy.email}
                        reason={reduction.reason ?? ""}
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {reductions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune demande.
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
                <a
                  href={pageHref(page - 1)}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-sm hover:bg-muted"
                >
                  Precedent
                </a>
              )}
              {page >= totalPages ? (
                <span className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-sm opacity-50">
                  Suivant
                </span>
              ) : (
                <a
                  href={pageHref(page + 1)}
                  className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-white px-3 text-sm hover:bg-muted"
                >
                  Suivant
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Historique de traitement</h2>
            <span className="text-sm text-muted-foreground">{formatNumber(processedByMe.length)} demandes</span>
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
                <TableHead>Demandeur</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedByMe.map((reduction) => (
                <TableRow key={reduction.id}>
                  <TableCell>
                    {reduction.reviewedAt ? new Date(reduction.reviewedAt).toLocaleString("fr-FR") : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{reduction.taxpayer.name}</div>
                    <div className="text-xs text-slate-500">{reduction.taxpayer.code ?? "-"}</div>
                  </TableCell>
                  <TableCell>{reduction.notice.number}</TableCell>
                  <TableCell>{formatMoney(Number(reduction.amount))}</TableCell>
                  <TableCell>{reduction.createdBy.name ?? reduction.createdBy.email}</TableCell>
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
                  <TableCell>{reduction.reviewNote ?? "-"}</TableCell>
                </TableRow>
              ))}
              {processedByMe.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun traitement enregistre.
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
