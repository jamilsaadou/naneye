import Link from "next/link";
import { FileSpreadsheet, Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SALUBRITE_CODE = "SALUBRITE";

export default async function ImportPage() {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }

  const taxes = await prisma.tax.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
  });
  const measureTaxes = taxes.filter((tax) => tax.code.toUpperCase() !== SALUBRITE_CODE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Téléchargez le modèle Excel d&apos;importation, rempli avec les taxes disponibles.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Modèle Excel dynamique
          </div>
          <p className="text-sm text-muted-foreground">
            Le modèle est généré automatiquement avec les colonnes des taxes actives.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{measureTaxes.length} taxes de mesure</Badge>
            <Badge variant="outline">{taxes.length} taxes actives</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href="/api/import/template">
                <DownloadButton />
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/taxes">Voir les taxes</Link>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            Colonnes obligatoires: Nom, Téléphone, Catégorie, Commune, Quartier, Date début activité.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Upload className="h-5 w-5 text-slate-600" />
            Importation des fichiers
          </div>
          <p className="text-sm text-muted-foreground">
            Chargez le fichier Excel complété pour importer les contribuables.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-muted-foreground">
            Importation en cours de configuration.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DownloadButton() {
  return (
    <span className="inline-flex items-center gap-2">
      <FileSpreadsheet className="h-4 w-4" />
      Télécharger le modèle
    </span>
  );
}
