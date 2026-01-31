import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createTaxpayerCategory, deleteTaxpayerCategory, updateTaxpayerCategory } from "@/app/taxpayers/categories/actions";

export default async function TaxpayerCategoriesPage() {
  const categories = await prisma.taxpayerCategory.findMany({ orderBy: { label: "asc" } });
  const categoryCounts = categories.length
    ? await prisma.taxpayer.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { category: { in: categories.map((category) => category.label) } },
      })
    : [];
  const countByCategory = new Map(
    categoryCounts
      .filter((row) => typeof row.category === "string")
      .map((row) => [row.category as string, row._count._all]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Categories de contribuables</h1>
          <p className="text-sm text-muted-foreground">Montant de la taxe de salubrite par categorie.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter une categorie</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createTaxpayerCategory}
            className="grid gap-3 md:grid-cols-4"
            successMessage="Categorie enregistree."
          >
            <Input name="label" placeholder="Libelle" required />
            <Input name="code" placeholder="Code (ex: 13)" required />
            <Input name="sanitationAmount" placeholder="Montant salubrite" type="number" step="0.01" required />
            <Button type="submit" className="md:col-span-4">
              + Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Liste des categories</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libelle</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Salubrite</TableHead>
                <TableHead>Contribuables</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => {
                const taxpayerCount = countByCategory.get(category.label) ?? 0;
                const canDelete = taxpayerCount === 0;
                return (
                  <TableRow key={category.id}>
                  <TableCell>{category.label}</TableCell>
                  <TableCell>{category.code ?? "-"}</TableCell>
                  <TableCell>{category.sanitationAmount.toString()}</TableCell>
                  <TableCell>{taxpayerCount}</TableCell>
                  <TableCell>
                    <details className="relative">
                      <summary className="cursor-pointer text-sm text-primary">Modifier</summary>
                      <ActionForm
                        action={updateTaxpayerCategory}
                        className="absolute right-0 z-10 mt-2 w-72 rounded-md border bg-white p-3 shadow-lg"
                        successMessage="Categorie mise a jour."
                      >
                        <input type="hidden" name="id" value={category.id} />
                        <div className="space-y-2">
                          <Input name="label" defaultValue={category.label} required />
                          <Input name="code" defaultValue={category.code ?? ""} required />
                          <Input
                            name="sanitationAmount"
                            type="number"
                            step="0.01"
                            defaultValue={category.sanitationAmount.toString()}
                            required
                          />
                          <Button type="submit" className="w-full">
                            Sauvegarder
                          </Button>
                        </div>
                      </ActionForm>
                    </details>
                    <ActionForm
                      action={deleteTaxpayerCategory}
                      className="mt-2"
                      successMessage="Categorie supprimée."
                      showMessage={false}
                    >
                      <input type="hidden" name="id" value={category.id} />
                      <Button type="submit" variant="outline" size="sm" disabled={!canDelete}>
                        Supprimer
                      </Button>
                      {!canDelete ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Supprimez d&apos;abord les contribuables de cette categorie.
                        </div>
                      ) : null}
                    </ActionForm>
                  </TableCell>
                </TableRow>
                );
              })}
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune categorie configuree.
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
