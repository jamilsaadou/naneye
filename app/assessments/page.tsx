import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BulkNoticeGenerator } from "./components/bulk-notice-generator";

export default async function AssessmentsPage() {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }

  const scopedCommune = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const [categories, communes, neighborhoods, groups] = await Promise.all([
    prisma.taxpayerCategory.findMany({
      select: { id: true, label: true },
      orderBy: { label: "asc" },
    }),
    prisma.commune.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      ...(scopedCommune ? { where: { name: scopedCommune } } : {}),
    }),
    prisma.neighborhood.findMany({
      select: { id: true, name: true, commune: { select: { name: true } } },
      orderBy: { name: "asc" },
      ...(scopedCommune ? { where: { commune: { name: scopedCommune } } } : {}),
    }),
    prisma.taxpayerGroup.findMany({
      select: { id: true, name: true, isGlobal: true, communes: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
      ...(scopedCommune
        ? { where: { OR: [{ isGlobal: true }, { communes: { some: { name: scopedCommune } } }] } }
        : {}),
    }),
  ]);

  const currentYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-semibold">Avis d&apos;imposition</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Generation groupee par categorie, commune ou quartier avec export ZIP des avis.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Generation groupee</h2>
          <p className="text-sm text-muted-foreground">
            Selectionnez vos filtres, lancez la generation, puis telechargez le pack PDF si besoin.
          </p>
        </CardHeader>
        <CardContent>
          <BulkNoticeGenerator
            categories={categories}
            communes={communes}
            neighborhoods={neighborhoods.map((item) => ({
              id: item.id,
              name: item.name,
              communeName: item.commune.name,
            }))}
            groups={groups.map((group) => ({
              id: group.id,
              name: group.name,
              isGlobal: group.isGlobal,
              communes: group.communes.map((commune) => ({ id: commune.id, name: commune.name })),
            }))}
            scopedCommune={scopedCommune}
            defaultYear={currentYear}
          />
        </CardContent>
      </Card>
    </div>
  );
}
