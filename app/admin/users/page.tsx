import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createUser } from "./actions";

const roles = [
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "AGENT", label: "Agent" },
  { value: "CAISSIER", label: "Caissier" },
  { value: "AUDITEUR", label: "Auditeur" },
] as const;

function formatLastLogin(date: Date | null): { text: string; isRecent: boolean } {
  if (!date) return { text: "Jamais connecté", isRecent: false };

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  // Considéré comme "en ligne" si connecté dans les 15 dernières minutes
  const isRecent = minutes < 15;

  if (minutes < 1) return { text: "À l'instant", isRecent: true };
  if (minutes < 60) return { text: `Il y a ${minutes} min`, isRecent };
  if (hours < 24) return { text: `Il y a ${hours}h`, isRecent: false };
  if (days < 7) return { text: `Il y a ${days}j`, isRecent: false };

  return {
    text: date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }),
    isRecent: false
  };
}

export default async function AdminUsersPage() {
  const [users, communes] = await Promise.all([
    prisma.user.findMany({ include: { commune: true, accessibleCommunes: true }, orderBy: { createdAt: "desc" } }),
    prisma.commune.findMany({ orderBy: { name: "asc" } }),
  ]);
  const supervisors = users.filter((user) => user.role === "SUPER_ADMIN" || user.role === "ADMIN");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Utilisateurs</h1>
        <p className="text-sm text-muted-foreground">Gestion des comptes et des rôles.</p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ajouter un utilisateur</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={createUser} className="grid gap-3 md:grid-cols-4" successMessage="Utilisateur créé.">
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="name" placeholder="Nom complet" />
            <Input name="password" type="password" placeholder="Mot de passe" required />
            <select
              name="role"
              defaultValue="AGENT"
              className="h-9 rounded-md border border-border bg-white px-3 text-sm"
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            <select name="communeId" className="h-9 rounded-md border border-border bg-white px-3 text-sm">
              <option value="">Commune (toutes)</option>
              {communes.map((commune) => (
                <option key={commune.id} value={commune.id}>
                  {commune.name}
                </option>
              ))}
            </select>
            <select name="supervisorId" className="h-9 rounded-md border border-border bg-white px-3 text-sm">
              <option value="">Supérieur hiérarchique (optionnel)</option>
              {supervisors.map((supervisor) => (
                <option key={supervisor.id} value={supervisor.id}>
                  {supervisor.name ?? supervisor.email} · {supervisor.role}
                  {supervisor.commune?.name ? ` · ${supervisor.commune.name}` : " · Global"}
                </option>
              ))}
            </select>
            <Button type="submit" className="md:col-span-4">
              + Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Liste des utilisateurs</h2>
            <span className="text-sm text-muted-foreground">{users.length} enregistrements</span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Commune</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const loginStatus = formatLastLogin(user.lastLoginAt);
                const communeDisplay = user.accessibleCommunes.length > 0
                  ? user.accessibleCommunes.map((c) => c.name).join(", ")
                  : user.commune?.name ?? (user.role === "SUPER_ADMIN" ? "Toutes" : "-");
                return (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.name ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="truncate" title={communeDisplay}>{communeDisplay}</span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            loginStatus.isRecent ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={loginStatus.isRecent ? "En ligne" : "Hors ligne"}
                        />
                        <span className={loginStatus.isRecent ? "text-emerald-700" : "text-slate-500"}>
                          {loginStatus.text}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/admin/users/${user.id}`}>Modifier</a>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun utilisateur trouvé.
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
