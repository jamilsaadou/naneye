import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const roles = [
  {
    name: "Super admin",
    description: "Accès total, suppression définitive et contrôle global.",
    permissions: "Toutes les permissions, suppression des contribuables.",
  },
  {
    name: "Admin",
    description: "Accès complet, paramétrage et supervision.",
    permissions: "Toutes les permissions.",
  },
  {
    name: "Agent",
    description: "Gestion des contribuables et avis.",
    permissions: "Contribuables, avis, consultations.",
  },
  {
    name: "Caissier",
    description: "Encaissements et reçus.",
    permissions: "Paiements, reçus, suivi caisse.",
  },
  {
    name: "Auditeur",
    description: "Lecture seule et audits.",
    permissions: "Rapports, audit log, export.",
  },
];

export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rôles & RBAC</h1>
        <p className="text-sm text-muted-foreground">
          Vue synthétique des rôles applicatifs et des accès.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Rôles disponibles</h2>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions clés</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.name}>
                  <TableCell>{role.name}</TableCell>
                  <TableCell>{role.description}</TableCell>
                  <TableCell>{role.permissions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
