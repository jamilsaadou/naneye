import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default async function ApiLogsPage() {
  const user = await getUserWithCommune();
  const scopedCommune = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;

  const logs = await prisma.collectorApiLog.findMany({
    where: scopedCommune ? { collector: { payments: { some: { notice: { taxpayer: { commune: scopedCommune } } } } } } : undefined,
    include: { collector: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Journal API</h1>
        <p className="text-sm text-muted-foreground">Trafic et reponses des API collecteurs.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Derniers appels</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Collecteur</TableHead>
                <TableHead>TxnId</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{new Date(log.createdAt).toLocaleString("fr-FR")}</TableCell>
                  <TableCell>{log.collector?.name ?? "-"}</TableCell>
                  <TableCell>{log.requestTxnId ?? "-"}</TableCell>
                  <TableCell>{log.noticeNumber ?? "-"}</TableCell>
                  <TableCell>{log.status}</TableCell>
                  <TableCell>{log.message ?? "-"}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun appel enregistre.
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
