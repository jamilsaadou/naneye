import { prisma } from "@/lib/prisma";
import { getSession, getUserWithCommune } from "@/lib/auth";
import Link from "next/link";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { approveTaxpayer, archiveTaxpayer, deleteTaxpayer } from "./actions";
import { TaxpayerDetailsModal, type TaxpayerModalData, type TaxpayerModalLog } from "./taxpayer-details-modal";
import { DeleteNoticeModal } from "./delete-notice-modal";
import { TaxpayerFilters } from "./components/taxpayer-filters";

const STATUS_PENDING = "EN_ATTENTE";
const STATUS_ACTIVE = "ACTIVE";
const STATUS_ARCHIVED = "ARCHIVED";

const TAXPAYER_STATUS_LABELS: Record<string, string> = {
  [STATUS_PENDING]: "En attente",
  [STATUS_ACTIVE]: "Approuvé",
  [STATUS_ARCHIVED]: "Archivé",
};


const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Non payé",
  PARTIAL: "Partiel",
  PAID: "Payé",
};

const moneyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "XOF",
  maximumFractionDigits: 0,
});

function formatMoney(value?: number | string | null) {
  if (value === null || value === undefined) return "-";
  return moneyFormatter.format(Number(value));
}

type SearchParams = {
  q?: string;
  neighborhood?: string;
  commune?: string;
  status?: string;
  category?: string;
  groupId?: string;
};

type TaxpayerWithNotices = {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  neighborhood: string;
  commune: string;
  status: string | null;
  category: string | null;
  address: string | null;
  email: string | null;
  photoUrl: string | null;
  comment: string | null;
  latitude: unknown;
  longitude: unknown;
  startedAt: Date | null;
  group: { id: string; name: string; isGlobal: boolean } | null;
  notices: Array<{
    id: string;
    number: string;
    status: string;
    totalAmount: number | string;
    amountPaid: number | string;
    taxpayerId: string;
    periodStart: Date;
    periodEnd: Date;
    locked: boolean;
    lockedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
};

export default async function TaxpayersPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const [session, user] = await Promise.all([getSession(), getUserWithCommune()]);
  const canDeleteTaxpayer = session?.role === "SUPER_ADMIN";
  const canDeleteNotice = session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const scopedCommune = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;
  const params = (await Promise.resolve(searchParams)) ?? {};
  const where: Record<string, any> = {};
  const filterCommune = scopedCommune ? undefined : params.commune;
  const activeStatus = params.status ?? "";
  const statusTabs = [
    { value: "", label: "Tous" },
    { value: STATUS_PENDING, label: TAXPAYER_STATUS_LABELS[STATUS_PENDING] },
    { value: STATUS_ACTIVE, label: TAXPAYER_STATUS_LABELS[STATUS_ACTIVE] },
    { value: STATUS_ARCHIVED, label: TAXPAYER_STATUS_LABELS[STATUS_ARCHIVED] },
  ];

  const buildStatusHref = (statusValue: string) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.neighborhood) query.set("neighborhood", params.neighborhood);
    if (filterCommune) query.set("commune", filterCommune);
    if (params.category) query.set("category", params.category);
    if (params.groupId) query.set("groupId", params.groupId);
    if (statusValue) query.set("status", statusValue);

    const queryString = query.toString();
    return queryString ? `/taxpayers?${queryString}` : "/taxpayers";
  };

  if (params.q) {
    where.OR = [
      { code: { contains: params.q, mode: "insensitive" } },
      { name: { contains: params.q, mode: "insensitive" } },
      { phone: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.neighborhood) {
    where.neighborhood = { contains: params.neighborhood, mode: "insensitive" };
  }
  if (scopedCommune) {
    where.commune = scopedCommune;
  } else if (filterCommune) {
    where.commune = { contains: filterCommune, mode: "insensitive" };
  }
  if (params.status) {
    where.status = params.status;
  }
  if (params.category) {
    where.category = params.category;
  }
  if (params.groupId) {
    where.groupId = params.groupId;
  }

  const [communeOptions, neighborhoodOptions, categoryOptions, groupOptions] = await Promise.all([
    prisma.commune.findMany({
      select: { id: true, name: true },
      where: scopedCommune ? { name: scopedCommune } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.neighborhood.findMany({
      select: { id: true, name: true, commune: { select: { name: true } } },
      where: scopedCommune ? { commune: { name: scopedCommune } } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.taxpayerCategory.findMany({
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    prisma.taxpayerGroup.findMany({
      select: { id: true, name: true, isGlobal: true, communes: { select: { id: true, name: true } } },
      where: scopedCommune
        ? {
            OR: [{ isGlobal: true }, { communes: { some: { name: scopedCommune } } }],
          }
        : undefined,
      orderBy: { name: "asc" },
    }),
  ]);
  const groupLabelById = new Map(groupOptions.map((group) => [group.id, group.name]));
  const activeFilters = [
    params.q ? `Recherche: ${params.q}` : null,
    params.neighborhood ? `Quartier: ${params.neighborhood}` : null,
    scopedCommune ? `Commune: ${scopedCommune}` : null,
    filterCommune ? `Commune: ${filterCommune}` : null,
    params.category ? `Catégorie: ${params.category}` : null,
    params.groupId ? `Groupe: ${groupLabelById.get(params.groupId) ?? params.groupId}` : null,
    params.status ? `Statut: ${TAXPAYER_STATUS_LABELS[params.status] ?? params.status}` : null,
  ].filter(Boolean) as string[];

  const taxpayers = (await prisma.taxpayer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      notices: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      group: true,
    },
  })) as unknown as TaxpayerWithNotices[];

  const taxpayerIds = taxpayers.map((taxpayer) => taxpayer.id);
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "TAXPAYER", entityId: { in: taxpayerIds } },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const logsByTaxpayer = new Map<string, TaxpayerModalLog[]>();
  for (const log of auditLogs) {
    const existing = logsByTaxpayer.get(log.entityId) ?? [];
    if (existing.length < 5) {
      existing.push({
        id: log.id,
        action: log.action,
        actorName: log.actor?.name ?? log.actor?.email ?? "Système",
        createdAt: new Date(log.createdAt).toLocaleString("fr-FR"),
      });
      logsByTaxpayer.set(log.entityId, existing);
    }
  }

  const photos = await prisma.taxpayerPhoto.findMany({
    where: { taxpayerId: { in: taxpayerIds } },
    orderBy: { createdAt: "desc" },
  });
  const photosByTaxpayer = new Map<string, string[]>();
  for (const photo of photos) {
    const existing = photosByTaxpayer.get(photo.taxpayerId) ?? [];
    existing.push(photo.url);
    photosByTaxpayer.set(photo.taxpayerId, existing);
  }

  const notices = await prisma.notice.findMany({
    where: { taxpayerId: { in: taxpayerIds } },
    select: { taxpayerId: true, periodStart: true, totalAmount: true, amountPaid: true },
  });
  const paymentsByTaxpayer = new Map<string, Map<number, { total: number; paid: number }>>();
  for (const notice of notices) {
    const year = notice.periodStart.getFullYear();
    const byYear = paymentsByTaxpayer.get(notice.taxpayerId) ?? new Map();
    const current = byYear.get(year) ?? { total: 0, paid: 0 };
    current.total += Number(notice.totalAmount);
    current.paid += Number(notice.amountPaid);
    byYear.set(year, current);
    paymentsByTaxpayer.set(notice.taxpayerId, byYear);
  }

  const payments = await prisma.payment.findMany({
    where: { notice: { taxpayerId: { in: taxpayerIds } } },
    include: { notice: { select: { number: true, taxpayerId: true } } },
    orderBy: { paidAt: "desc" },
    take: 500,
  });
  const paymentHistoryByTaxpayer = new Map<string, TaxpayerModalData["paymentHistory"]>();
  for (const payment of payments) {
    const taxpayerId = payment.notice.taxpayerId;
    const existing = paymentHistoryByTaxpayer.get(taxpayerId) ?? [];
    if (existing.length >= 5) continue;
    existing.push({
      id: payment.id,
      paidAt: new Date(payment.paidAt).toLocaleString("fr-FR"),
      amount: Number(payment.amount),
      method: payment.method,
      noticeNumber: payment.notice.number,
      proofUrl: payment.proofUrl ?? null,
    });
    paymentHistoryByTaxpayer.set(taxpayerId, existing);
  }

  const reductions = await prisma.noticeReduction.findMany({
    where: { taxpayerId: { in: taxpayerIds }, status: "APPROVED" },
    include: {
      notice: { select: { number: true, year: true } },
      createdBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const reductionsByTaxpayer = new Map<string, TaxpayerModalData["reductions"]>();
  for (const reduction of reductions) {
    const existing = reductionsByTaxpayer.get(reduction.taxpayerId) ?? [];
    if (existing.length >= 5) continue;
    existing.push({
      id: reduction.id,
      noticeNumber: reduction.notice.number,
      year: reduction.notice.year,
      amount: Number(reduction.amount),
      previousTotal: Number(reduction.previousTotal),
      newTotal: Number(reduction.newTotal),
      reason: reduction.reason ?? null,
      createdAt: new Date(reduction.createdAt).toLocaleString("fr-FR"),
      author: reduction.createdBy?.name ?? reduction.createdBy?.email ?? "Systeme",
    });
    reductionsByTaxpayer.set(reduction.taxpayerId, existing);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contribuables</h1>
        <p className="text-sm text-muted-foreground">Recherche et gestion rapide.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-emerald-700" />
                <h2 className="text-lg font-semibold">Filtres dynamiques</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Affinez la liste par zone, statut ou mot-clé.</p>
            </div>
            <Button asChild variant="outline">
              <Link href="/taxpayers">Réinitialiser</Link>
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeFilters.length > 0 ? (
              activeFilters.map((label) => (
                <Badge key={label} variant="outline" className="border-slate-200 text-slate-700">
                  {label}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">Aucun filtre actif.</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 pb-4">
            {statusTabs.map((tab) => {
              const isActive = activeStatus === tab.value;
              return (
                <Link
                  key={tab.value || "all"}
                  href={buildStatusHref(tab.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <TaxpayerFilters
            scopedCommune={scopedCommune}
            communeOptions={communeOptions}
            neighborhoodOptions={neighborhoodOptions.map((item) => ({
              id: item.id,
              name: item.name,
              communeName: item.commune.name,
            }))}
            categoryOptions={categoryOptions.map((item) => ({
              id: item.id,
              label: item.label,
            }))}
            groupOptions={groupOptions.map((group) => ({
              id: group.id,
              name: group.name,
              isGlobal: group.isGlobal,
              communes: group.communes.map((commune) => ({ id: commune.id, name: commune.name })),
            }))}
            initialValues={{
              q: params.q ?? "",
              neighborhood: params.neighborhood ?? "",
              commune: params.commune ?? "",
              status: params.status ?? "",
              category: params.category ?? "",
              groupId: params.groupId ?? "",
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Liste des contribuables</h2>
            <span className="text-sm text-muted-foreground">{taxpayers.length} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code contribuable</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Groupe</TableHead>
                <TableHead>Statut fiscal</TableHead>
                <TableHead>Montant dû</TableHead>
                <TableHead>Montant payé</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxpayers.map((taxpayer) => {
                const latestNotice = taxpayer.notices[0];
                const total = latestNotice ? Number(latestNotice.totalAmount) : null;
                const paid = latestNotice ? Number(latestNotice.amountPaid) : null;
                const due = total !== null && paid !== null ? Math.max(total - paid, 0) : null;
                const fiscalStatus = latestNotice?.status ?? "UNPAID";
                const paymentMap = paymentsByTaxpayer.get(taxpayer.id) ?? new Map();
                const paymentSummary = Array.from(paymentMap.entries())
                  .map(([year, values]) => ({
                    year,
                    total: values.total,
                    paid: values.paid,
                    due: Math.max(values.total - values.paid, 0),
                  }))
                  .sort((a, b) => b.year - a.year);
                const modalData: TaxpayerModalData = {
                  id: taxpayer.id,
                  code: taxpayer.code,
                  name: taxpayer.name,
                  category: taxpayer.category,
                  groupName: taxpayer.group?.name ?? null,
                  commune: taxpayer.commune,
                  neighborhood: taxpayer.neighborhood,
                  phone: taxpayer.phone,
                  email: taxpayer.email,
                  address: taxpayer.address,
                  photoUrls: photosByTaxpayer.get(taxpayer.id) ?? [],
                  comment: taxpayer.comment,
                  latitude: taxpayer.latitude ? String(taxpayer.latitude) : null,
                  longitude: taxpayer.longitude ? String(taxpayer.longitude) : null,
                  startedAt: taxpayer.startedAt ? taxpayer.startedAt.toISOString() : null,
                  latestNotice: latestNotice
                    ? {
                        number: latestNotice.number,
                        status: latestNotice.status,
                        totalAmount: Number(latestNotice.totalAmount),
                        amountPaid: Number(latestNotice.amountPaid),
                      }
                    : null,
                  paymentSummary,
                  paymentHistory: paymentHistoryByTaxpayer.get(taxpayer.id) ?? [],
                  reductions: reductionsByTaxpayer.get(taxpayer.id) ?? [],
                };
                const modalLogs = logsByTaxpayer.get(taxpayer.id) ?? [];
                const noticeYears = paymentSummary.map((summary) => summary.year);
                return (
                  <TableRow key={taxpayer.id}>
                    <TableCell>{taxpayer.code ?? "-"}</TableCell>
                    <TableCell>{taxpayer.name}</TableCell>
                    <TableCell>{taxpayer.commune}</TableCell>
                    <TableCell>{taxpayer.category ?? "-"}</TableCell>
                    <TableCell>{taxpayer.group?.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          fiscalStatus === "PAID" ? "success" : fiscalStatus === "PARTIAL" ? "warning" : "outline"
                        }
                      >
                        {STATUS_LABELS[fiscalStatus] ?? "Non payé"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMoney(due)}</TableCell>
                    <TableCell>{formatMoney(paid)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <TaxpayerDetailsModal taxpayer={modalData} logs={modalLogs} />
                        <Button asChild size="sm" variant="outline" className="h-8 w-8 p-0" title="Modifier">
                          <a href={`/taxpayers/${taxpayer.id}`} aria-label="Modifier">
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                            </svg>
                          </a>
                        </Button>
                        {taxpayer.status === STATUS_PENDING ? (
                          <form action={approveTaxpayer}>
                            <input type="hidden" name="id" value={taxpayer.id} />
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Approuver">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            </Button>
                          </form>
                        ) : null}
                        {latestNotice ? (
                          <Button asChild size="sm" variant="outline" className="h-8 w-8 p-0" title="Télécharger avis">
                            <a href={`/assessments/${latestNotice.id}/print`} aria-label="Télécharger avis">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 3v12" />
                                <path d="m7 10 5 5 5-5" />
                                <path d="M5 21h14" />
                              </svg>
                            </a>
                          </Button>
                        ) : null}
                        {canDeleteNotice ? (
                          <DeleteNoticeModal taxpayerId={taxpayer.id} years={noticeYears} />
                        ) : null}
                        {canDeleteTaxpayer ? (
                          <form action={deleteTaxpayer}>
                            <input type="hidden" name="taxpayerId" value={taxpayer.id} />
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Supprimer le contribuable">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M6 6l1 14h10l1-14" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 3h6" />
                              </svg>
                            </Button>
                          </form>
                        ) : null}
                      </div>
                      <form action={archiveTaxpayer} className="mt-2">
                        <input type="hidden" name="id" value={taxpayer.id} />
                        <Button type="submit" variant="outline" size="sm">
                          Archiver
                        </Button>
                      </form>
                    </TableCell>
                  </TableRow>
                );
              })}
              {taxpayers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun contribuable trouvé.
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
