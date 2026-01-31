import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createCommune, updateCommune } from "./actions";

export default async function CommunesPage() {
  const communes = await prisma.commune.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Communes</h1>
          <p className="text-sm text-muted-foreground">Créer et mettre a jour les communes.</p>
        </div>
        <Button asChild variant="outline">
          <a href="/admin/settings">Retour</a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter une commune</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={createCommune} className="grid gap-3 md:grid-cols-3" successMessage="Commune enregistrée.">
            <Input name="name" placeholder="Nom de la commune" required />
            <Input name="code" placeholder="Code (ex: 1)" required />
            <Button type="submit">+ Ajouter</Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Liste des communes</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {communes.map((commune) => (
                <TableRow key={commune.id}>
                  <TableCell>{commune.name}</TableCell>
                  <TableCell>{commune.code ?? "-"}</TableCell>
                  <TableCell>
                    <details className="relative">
                      <summary className="cursor-pointer text-sm text-primary">Modifier</summary>
                      <ActionForm
                        action={updateCommune}
                        className="absolute right-0 z-10 mt-2 w-72 rounded-md border bg-white p-3 shadow-lg"
                        successMessage="Commune mise à jour."
                      >
                        <input type="hidden" name="id" value={commune.id} />
                        <div className="space-y-2">
                          <Input name="name" defaultValue={commune.name} required />
                          <Input name="code" defaultValue={commune.code ?? ""} required />
                          <Button type="submit" className="w-full">
                            Sauvegarder
                          </Button>
                        </div>
                      </ActionForm>
                    </details>
                  </TableCell>
                </TableRow>
              ))}
              {communes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                    Aucune commune configurée.
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
