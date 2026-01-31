import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

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

const ACTION_LABELS: Record<string, string> = {
  NOTICE_REDUCTION_REQUESTED: "Demande de reduction",
  NOTICE_REDUCTION_APPLIED: "Reduction appliquee",
  NOTICE_REDUCTION_APPROVED: "Reduction approuvee",
  NOTICE_REDUCTION_REJECTED: "Reduction rejetee",
  NOTICE_REDUCTION: "Reduction",
  PAYMENT_MANUAL_CREATED: "Paiement manuel",
  TAXPAYER_CREATED: "Contribuable cree",
  TAXPAYER_UPDATED: "Contribuable mis a jour",
  TAXPAYER_ARCHIVED: "Contribuable archive",
  TAXPAYER_DELETED: "Contribuable supprime",
  TAXPAYER_APPROVED: "Contribuable approuve",
  TAXPAYER_GROUP_CREATED: "Groupe contribuable cree",
  TAXPAYER_GROUP_UPDATED: "Groupe contribuable modifie",
  TAXPAYER_GROUP_DELETED: "Groupe contribuable supprime",
  NOTICE_DELETED: "Avis supprime",
  TAXPAYER_NOTICE_CALCULATED: "Avis calcule",
  GLOBAL_NOTICE_CALCULATED: "Calcul global des avis",
  BULK_NOTICE_CALCULATED: "Calcul groupe des avis",
};

const ENTITY_LABELS: Record<string, string> = {
  NOTICE: "Avis d'imposition",
  TAXPAYER: "Contribuable",
  SYSTEM: "Systeme",
};

function getEntityLabel(log: { entityType: string; entityId: string; after: Prisma.JsonValue | null }) {
  const label = ENTITY_LABELS[log.entityType] ?? log.entityType;
  const after = (log.after ?? null) as Record<string, any> | null;

  if (log.entityType === "TAXPAYER") {
    const code = after?.code ?? after?.taxpayerCode ?? null;
    return code ? `${label} - ${code}` : `${label} - ${log.entityId}`;
  }

  if (log.entityType === "NOTICE") {
    const noticeNumber = after?.noticeNumber ?? null;
    return noticeNumber ? `${label} - ${noticeNumber}` : `${label} - ${log.entityId}`;
  }

  return `${label} - ${log.entityId}`;
}

function describeLog(log: { action: string; after: Prisma.JsonValue | null }) {
  const after = (log.after ?? null) as Record<string, any> | null;
  if (!after) return "-";

  if (log.action.startsWith("NOTICE_REDUCTION")) {
    const taxpayer = after.taxpayerName ?? "-";
    const notice = after.noticeNumber ?? "-";
    const reduction = after.reduction ?? "-";
    const status = after.status ? ` · ${after.status}` : "";
    return `${taxpayer} · avis ${notice} · reduction ${reduction}${status}`;
  }

  if (log.action.startsWith("TAXPAYER")) {
    const name = after.name ?? after.taxpayerName ?? "-";
    const code = after.code ?? after.taxpayerCode ?? "-";
    return `${name} · ${code}`;
  }

  if (log.action.startsWith("PAYMENT")) {
    const notice = after.noticeNumber ?? "-";
    const amount = after.amount ?? "-";
    const method = after.method ?? "-";
    return `avis ${notice} · montant ${amount} · ${method}`;
  }

  if (log.action === "GLOBAL_NOTICE_CALCULATED") {
    return `annee ${after.year ?? "-"}`;
  }

  if (log.action === "BULK_NOTICE_CALCULATED") {
    const scope = after.scope ?? "-";
    const year = after.year ?? "-";
    const matched = after.matched ?? "-";
    return `annee ${year} · ${scope} · ${matched} contribuables`;
  }

  return "-";
}

export default async function LogsPage({ searchParams }: { searchParams?: SearchParams }) {
  const actionParam = getParam(searchParams, "action") ?? "all";
  const actorParam = getParam(searchParams, "actorId") ?? "all";
  const pageSizeParam = Number.parseInt(getParam(searchParams, "pageSize") ?? "10", 10);
  const pageSize = [10, 50, 100].includes(pageSizeParam) ? pageSizeParam : 10;
  const page = Math.max(1, Number.parseInt(getParam(searchParams, "page") ?? "1", 10) || 1);
  const fromDate = parseDate(getParam(searchParams, "from"));
  const toDate = parseDate(getParam(searchParams, "to"), true);

  const createdAtFilter: Prisma.DateTimeFilter | undefined =
    fromDate || toDate
      ? {
          ...(fromDate ? { gte: fromDate } : {}),
          ...(toDate ? { lte: toDate } : {}),
        }
      : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(actionParam !== "all" ? { action: actionParam } : {}),
    ...(actorParam === "system"
      ? { actorId: null }
      : actorParam !== "all"
        ? { actorId: actorParam }
        : {}),
    ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
  };

  const [actions, users, total, logs] = await prisma.$transaction([
    prisma.auditLog.findMany({
      select: { action: true },
      distinct: ["action"],
      orderBy: { action: "asc" },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { actor: true },
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
        <h1 className="text-2xl font-semibold">Journal d&apos;activites</h1>
        <p className="text-sm text-muted-foreground">Historique des actions sur la plateforme.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Filtres</h2>
        </CardHeader>
        <CardContent>
          <form method="get" className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="page" value="1" />
            <select
              name="action"
              defaultValue={actionParam}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="all">Toutes les activites</option>
              {actions.map((entry) => (
                <option key={entry.action} value={entry.action}>
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </option>
              ))}
            </select>
            <select
              name="actorId"
              defaultValue={actorParam}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="all">Tous les utilisateurs</option>
              <option value="system">Systeme</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email ?? "Utilisateur"} ({user.email})
                </option>
              ))}
            </select>
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
            <div className="md:col-span-4 flex items-center gap-2">
              <Button type="submit">Filtrer</Button>
              <Button asChild variant="outline">
                <a href="/logs">Reinitialiser</a>
              </Button>
              <Button asChild variant="outline">
                <a href={`/logs/export?${params.toString()}`}>Exporter</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Journal</h2>
          <p className="text-sm text-muted-foreground">{total} enregistrements</p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Utilisateur</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entite</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                return (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.createdAt).toLocaleString("fr-FR")}</TableCell>
                    <TableCell>{log.actor?.name ?? log.actor?.email ?? "Systeme"}</TableCell>
                    <TableCell>{ACTION_LABELS[log.action] ?? log.action}</TableCell>
                    <TableCell>{getEntityLabel(log)}</TableCell>
                    <TableCell className="text-xs text-slate-600">{describeLog(log)}</TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune activite enregistree.
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
