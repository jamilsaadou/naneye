import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

export default async function CollectionsDuePage({
  searchParams,
}: {
  searchParams?: Promise<{ groupId?: string }>;
}) {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }
  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;
  const params = await searchParams;
  const groupId = params?.groupId ?? "";

  const groups = await prisma.taxpayerGroup.findMany({
    where: scopedCommune
      ? { OR: [{ isGlobal: true }, { communes: { some: { name: scopedCommune } } }] }
      : undefined,
    orderBy: { name: "asc" },
    include: { communes: { select: { name: true } } },
  });

  const taxpayerFilter = {
    ...(scopedCommune ? { commune: scopedCommune } : {}),
    ...(groupId ? { groupId } : {}),
  };

  const notices = await prisma.notice.findMany({
    where: {
      status: "UNPAID",
      ...(Object.keys(taxpayerFilter).length > 0 ? { taxpayer: taxpayerFilter } : {}),
    },
    include: { taxpayer: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Taxes dues</h1>
        <p className="text-sm text-muted-foreground">Factures fiscales non payees.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Avis en attente</h2>
            <span className="text-sm text-muted-foreground">{formatNumber(notices.length)} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium text-slate-900">
              Groupe
              <select
                name="groupId"
                defaultValue={groupId}
                className="mt-2 h-9 rounded-md border border-border bg-white px-3 text-sm"
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
            <Button type="submit" variant="outline" size="sm">
              Filtrer
            </Button>
          </form>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avis</TableHead>
                <TableHead>Contribuable</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Annee</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Paye</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notices.map((notice) => {
                const total = Number(notice.totalAmount);
                const paid = Number(notice.amountPaid);
                const due = Math.max(total - paid, 0);
                return (
                  <TableRow key={notice.id}>
                    <TableCell>{notice.number}</TableCell>
                    <TableCell>{notice.taxpayer.name}</TableCell>
                    <TableCell>{notice.taxpayer.commune}</TableCell>
                    <TableCell>{notice.year}</TableCell>
                    <TableCell>{formatMoney(total)}</TableCell>
                    <TableCell>{formatMoney(paid)}</TableCell>
                    <TableCell>{formatMoney(due)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">Non paye</Badge>
                    </TableCell>
                    <TableCell>
                      {notice.taxpayer.code ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={`/payments?code=${encodeURIComponent(notice.taxpayer.code)}&notice=${encodeURIComponent(
                            notice.number,
                          )}`}>Encaisser</a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Code manquant</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {notices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune facture fiscale due.
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
