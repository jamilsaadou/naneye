import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createTax, deleteTax, toggleTaxStatus, updateTax } from "./actions";

export default async function TaxesPage() {
  const taxes = await prisma.tax.findMany({
    orderBy: { createdAt: "desc" },
  });
  const taxIds = taxes.map((tax) => tax.id);
  const [measureCounts, ruleCounts, lineCounts] = await Promise.all([
    taxIds.length
      ? prisma.taxpayerMeasure.groupBy({
          by: ["taxId"],
          _count: { _all: true },
          where: { taxId: { in: taxIds } },
        })
      : Promise.resolve([]),
    taxIds.length
      ? prisma.taxRule.groupBy({
          by: ["taxId"],
          _count: { _all: true },
          where: { taxId: { in: taxIds } },
        })
      : Promise.resolve([]),
    taxIds.length
      ? prisma.noticeLine.groupBy({
          by: ["taxId"],
          _count: { _all: true },
          where: { taxId: { in: taxIds } },
        })
      : Promise.resolve([]),
  ]);
  const measureByTaxId = new Map(measureCounts.map((row) => [row.taxId, row._count._all]));
  const ruleByTaxId = new Map(ruleCounts.map((row) => [row.taxId, row._count._all]));
  const lineByTaxId = new Map(lineCounts.map((row) => [row.taxId, row._count._all]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Taxes</h1>
          <p className="text-sm text-muted-foreground">Création, activation et mise à jour.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/taxes/rules">Voir les règles</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter une taxe</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={createTax} className="grid gap-3 md:grid-cols-4" successMessage="Taxe enregistrée.">
            <Input name="code" placeholder="Code" required />
            <Input name="label" placeholder="Libellé" required />
            <Input name="rate" placeholder="Taux (ex: 0.0500)" required />
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input className="h-4 w-4" name="active" type="checkbox" defaultChecked />
              Active
            </label>
            <Button type="submit" className="md:col-span-4">
              + Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Liste des taxes</h2>
            <span className="text-sm text-muted-foreground">{taxes.length} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Taux</TableHead>
                <TableHead>Utilisation</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taxes.map((tax) => {
                const measureCount = measureByTaxId.get(tax.id) ?? 0;
                const ruleCount = ruleByTaxId.get(tax.id) ?? 0;
                const lineCount = lineByTaxId.get(tax.id) ?? 0;
                const canDelete = measureCount === 0 && ruleCount === 0 && lineCount === 0;
                return (
                  <TableRow key={tax.id}>
                  <TableCell>{tax.code}</TableCell>
                  <TableCell>{tax.label}</TableCell>
                  <TableCell>{tax.rate.toString()}</TableCell>
                  <TableCell>
                    <div className="text-xs text-muted-foreground">
                      Contribuables: <span className="text-slate-700">{measureCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Règles: <span className="text-slate-700">{ruleCount}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Avis: <span className="text-slate-700">{lineCount}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tax.active ? "success" : "outline"}>{tax.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <details className="relative">
                      <summary className="cursor-pointer text-sm text-primary">Modifier</summary>
                      <ActionForm
                        action={updateTax}
                        className="absolute right-0 z-10 mt-2 w-72 rounded-md border bg-white p-3 shadow-lg"
                        successMessage="Taxe mise à jour."
                      >
                        <input type="hidden" name="id" value={tax.id} />
                        <div className="space-y-2">
                          <Input name="code" defaultValue={tax.code} required />
                          <Input name="label" defaultValue={tax.label} required />
                          <Input name="rate" defaultValue={tax.rate.toString()} required />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input className="h-4 w-4" name="active" type="checkbox" defaultChecked={tax.active} />
                            Active
                          </label>
                          <Button type="submit" className="w-full">
                            Sauvegarder
                          </Button>
                        </div>
                      </ActionForm>
                    </details>
                    <ActionForm
                      action={toggleTaxStatus}
                      className="mt-2"
                      successMessage={tax.active ? "Taxe désactivée." : "Taxe activée."}
                    >
                      <input type="hidden" name="id" value={tax.id} />
                      <input type="hidden" name="active" value={String(!tax.active)} />
                      <Button type="submit" variant="outline" size="sm">
                        {tax.active ? "Désactiver" : "Activer"}
                      </Button>
                    </ActionForm>
                    <ActionForm
                      action={deleteTax}
                      className="mt-2"
                      successMessage="Taxe supprimée."
                      showMessage={false}
                    >
                      <input type="hidden" name="id" value={tax.id} />
                      <Button type="submit" variant="outline" size="sm" disabled={!canDelete}>
                        Supprimer
                      </Button>
                      {!canDelete ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Supprimez d&apos;abord les éléments liés.
                        </div>
                      ) : null}
                    </ActionForm>
                  </TableCell>
                  </TableRow>
                );
              })}
              {taxes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune taxe enregistrée.
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
