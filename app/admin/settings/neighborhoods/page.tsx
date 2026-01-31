import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createNeighborhood, updateNeighborhood } from "./actions";

export default async function NeighborhoodsPage() {
  const [communes, neighborhoods] = await Promise.all([
    prisma.commune.findMany({ orderBy: { name: "asc" } }),
    prisma.neighborhood.findMany({
      orderBy: [{ commune: { name: "asc" } }, { name: "asc" }],
      include: { commune: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Quartiers</h1>
          <p className="text-sm text-muted-foreground">Créer et organiser les quartiers par commune.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter un quartier</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createNeighborhood}
            className="grid gap-3 md:grid-cols-3"
            successMessage="Quartier enregistré."
          >
            <select name="communeId" required className="h-9 rounded-md border border-border bg-white px-3 text-sm">
              <option value="">Commune</option>
              {communes.map((commune) => (
                <option key={commune.id} value={commune.id}>
                  {commune.name}
                </option>
              ))}
            </select>
            <Input name="name" placeholder="Nom du quartier" required />
            <Button type="submit">+ Ajouter</Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Liste des quartiers</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commune</TableHead>
                <TableHead>Quartier</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {neighborhoods.map((neighborhood) => (
                <TableRow key={neighborhood.id}>
                  <TableCell>{neighborhood.commune.name}</TableCell>
                  <TableCell>{neighborhood.name}</TableCell>
                  <TableCell>
                    <details className="relative">
                      <summary className="cursor-pointer text-sm text-primary">Modifier</summary>
                      <ActionForm
                        action={updateNeighborhood}
                        className="absolute right-0 z-10 mt-2 w-72 rounded-md border bg-white p-3 shadow-lg"
                        successMessage="Quartier mis à jour."
                      >
                        <input type="hidden" name="id" value={neighborhood.id} />
                        <div className="space-y-2">
                          <select
                            name="communeId"
                            defaultValue={neighborhood.communeId}
                            className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                          >
                            {communes.map((commune) => (
                              <option key={commune.id} value={commune.id}>
                                {commune.name}
                              </option>
                            ))}
                          </select>
                          <Input name="name" defaultValue={neighborhood.name} required />
                          <Button type="submit" className="w-full">
                            Sauvegarder
                          </Button>
                        </div>
                      </ActionForm>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {neighborhoods.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun quartier configuré.
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
