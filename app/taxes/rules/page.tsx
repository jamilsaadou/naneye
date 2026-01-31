import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createTaxRule, toggleTaxRuleStatus, updateTaxRule } from "./actions";

export default async function TaxRulesPage() {
  const [rules, taxes] = await Promise.all([
    prisma.taxRule.findMany({
      orderBy: { createdAt: "desc" },
      include: { tax: true },
    }),
    prisma.tax.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Règles d’application des taxes</h1>
          <p className="text-sm text-muted-foreground">
            Filtrage par commune, quartier, catégorie ou zone.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/taxes">Retour aux taxes</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter une règle</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={createTaxRule} className="grid gap-3 md:grid-cols-6" successMessage="Règle enregistrée.">
            <select
              name="taxId"
              className="h-9 rounded-md border border-border bg-white px-3 text-sm md:col-span-2"
              required
            >
              <option value="">Taxe</option>
              {taxes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.label}
                </option>
              ))}
            </select>
            <Input name="commune" placeholder="Commune" />
            <Input name="neighborhood" placeholder="Quartier" />
            <Input name="category" placeholder="Catégorie" />
            <Input name="zone" placeholder="Zone" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground md:col-span-2">
              <input className="h-4 w-4" name="active" type="checkbox" defaultChecked />
              Active
            </label>
            <Button type="submit" className="md:col-span-6">
              + Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Règles enregistrées</h2>
            <span className="text-sm text-muted-foreground">{rules.length} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Taxe</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Quartier</TableHead>
                <TableHead>Catégorie</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>{rule.tax.label}</TableCell>
                  <TableCell>{rule.commune ?? "-"}</TableCell>
                  <TableCell>{rule.neighborhood ?? "-"}</TableCell>
                  <TableCell>{rule.category ?? "-"}</TableCell>
                  <TableCell>{rule.zone ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={rule.active ? "success" : "outline"}>{rule.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                  <TableCell>
                    <details className="relative">
                      <summary className="cursor-pointer text-sm text-primary">Modifier</summary>
                      <ActionForm
                        action={updateTaxRule}
                        className="absolute right-0 z-10 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg"
                        successMessage="Règle mise à jour."
                      >
                        <input type="hidden" name="id" value={rule.id} />
                        <div className="space-y-2">
                          <select
                            name="taxId"
                            defaultValue={rule.taxId}
                            className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                          >
                            {taxes.map((tax) => (
                              <option key={tax.id} value={tax.id}>
                                {tax.label}
                              </option>
                            ))}
                          </select>
                          <Input name="commune" defaultValue={rule.commune ?? ""} />
                          <Input name="neighborhood" defaultValue={rule.neighborhood ?? ""} />
                          <Input name="category" defaultValue={rule.category ?? ""} />
                          <Input name="zone" defaultValue={rule.zone ?? ""} />
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              className="h-4 w-4"
                              name="active"
                              type="checkbox"
                              defaultChecked={rule.active}
                            />
                            Active
                          </label>
                          <Button type="submit" className="w-full">
                            Sauvegarder
                          </Button>
                        </div>
                      </ActionForm>
                    </details>
                    <ActionForm
                      action={toggleTaxRuleStatus}
                      className="mt-2"
                      successMessage={rule.active ? "Règle désactivée." : "Règle activée."}
                    >
                      <input type="hidden" name="id" value={rule.id} />
                      <input type="hidden" name="active" value={String(!rule.active)} />
                      <Button type="submit" variant="outline" size="sm">
                        {rule.active ? "Désactiver" : "Activer"}
                      </Button>
                    </ActionForm>
                  </TableCell>
                </TableRow>
              ))}
              {rules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune règle enregistrée.
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
