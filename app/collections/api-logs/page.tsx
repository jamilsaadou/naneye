import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ApiLogsTable } from "./api-logs-table";

export default async function ApiLogsPage() {
  const user = await getUserWithCommune();
  const scopedCommune = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;

  const logs = await prisma.collectorApiLog.findMany({
    where: scopedCommune ? { collector: { payments: { some: { notice: { taxpayer: { commune: scopedCommune } } } } } } : undefined,
    include: { collector: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const formattedLogs = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    collectorName: log.collector?.name ?? null,
    status: log.status,
    message: log.message,
    requestPayload: log.requestPayload,
    responsePayload: log.responsePayload,
  }));

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
          <ApiLogsTable logs={formattedLogs} />
        </CardContent>
      </Card>
    </div>
  );
}
