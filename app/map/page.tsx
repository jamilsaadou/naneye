import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { TaxpayersMap } from "./taxpayers-map";

export default async function TaxpayersMapPage() {
  const user = await getUserWithCommune();
  const scopedCommune = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;
  const taxpayers = await prisma.taxpayer.findMany({
    where: {
      latitude: { not: null },
      longitude: { not: null },
      ...(scopedCommune ? { commune: scopedCommune } : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      commune: true,
      neighborhood: true,
      latitude: true,
      longitude: true,
      notices: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const mapped = taxpayers.map((taxpayer) => ({
    id: taxpayer.id,
    name: taxpayer.name,
    code: taxpayer.code,
    commune: taxpayer.commune,
    neighborhood: taxpayer.neighborhood,
    paymentStatus: taxpayer.notices[0]?.status ?? "UNPAID",
    latitude: taxpayer.latitude?.toString() ?? "",
    longitude: taxpayer.longitude?.toString() ?? "",
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Carte des contribuables</h1>
        <p className="text-sm text-muted-foreground">Visualisation OSM des contribuables géolocalisés.</p>
      </div>
      <TaxpayersMap taxpayers={mapped} />
    </div>
  );
}
