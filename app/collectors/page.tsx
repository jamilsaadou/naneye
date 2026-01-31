import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createCollector } from "./actions";
import { CollectorActions } from "./collector-actions";

const STATUS_ACTIVE = "ACTIVE";
const STATUS_SUSPENDED = "SUSPENDED";

export default async function CollectorsPage() {
  const collectors = await prisma.collector.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Collecteurs</h1>
        <p className="text-sm text-muted-foreground">Création, suspension et suivi des collecteurs.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter un collecteur</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={createCollector} className="grid gap-3 md:grid-cols-5" successMessage="Collecteur enregistré.">
            <Input name="code" placeholder="Code" required />
            <Input name="name" placeholder="Nom" required />
            <Input name="phone" placeholder="Téléphone" required />
            <Input name="email" placeholder="Email" type="email" required />
            <select
              name="status"
              defaultValue={STATUS_ACTIVE}
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value={STATUS_ACTIVE}>Actif</option>
              <option value={STATUS_SUSPENDED}>Suspendu</option>
            </select>
            <p className="md:col-span-5 text-xs text-muted-foreground">
              Un mot de passe sera généré automatiquement et envoyé par email.
            </p>
            <Button type="submit" className="md:col-span-5">
              + Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Liste des collecteurs</h2>
            <span className="text-sm text-muted-foreground">{collectors.length} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collectors.map((collector) => (
                <TableRow key={collector.id}>
                  <TableCell>{collector.code}</TableCell>
                  <TableCell>{collector.name}</TableCell>
                  <TableCell>{collector.phone}</TableCell>
                  <TableCell>{collector.email ?? "-"}</TableCell>
                  <TableCell>
                    <Badge variant={collector.status === STATUS_ACTIVE ? "success" : "warning"}>
                      {collector.status === STATUS_ACTIVE ? "Actif" : "Suspendu"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <CollectorActions
                      collector={{
                        id: collector.id,
                        code: collector.code,
                        name: collector.name,
                        phone: collector.phone,
                        email: collector.email,
                        status: collector.status,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {collectors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun collecteur trouvé.
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
