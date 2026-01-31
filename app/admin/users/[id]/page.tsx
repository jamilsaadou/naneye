import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/action-form";
import { updateUser } from "../actions";
import { MODULES } from "@/lib/modules";

const roles = [
  { value: "SUPER_ADMIN", label: "Super admin" },
  { value: "ADMIN", label: "Admin" },
  { value: "AGENT", label: "Agent" },
  { value: "CAISSIER", label: "Caissier" },
  { value: "AUDITEUR", label: "Auditeur" },
] as const;

export default async function AdminUserDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, communes, supervisors] = await Promise.all([
    prisma.user.findUnique({ where: { id }, include: { commune: true } }),
    prisma.commune.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["SUPER_ADMIN", "ADMIN"] } },
      include: { commune: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  if (!user) {
    return <div className="text-sm text-muted-foreground">Utilisateur introuvable.</div>;
  }

  const enabled = new Set(user.role === "SUPER_ADMIN" ? MODULES.map((module) => module.id) : user.enabledModules ?? []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier un utilisateur</h1>
          <p className="text-sm text-muted-foreground">Mettre a jour le profil et les modules visibles.</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/users">Retour</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Profil</h2>
        </CardHeader>
        <CardContent>
          <ActionForm action={updateUser} className="grid gap-4 md:grid-cols-2" successMessage="Utilisateur mis à jour.">
            <input type="hidden" name="id" value={user.id} />
            <label className="text-sm font-medium text-slate-900">
              Email
              <Input name="email" type="email" defaultValue={user.email} required className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Nom
              <Input name="name" defaultValue={user.name ?? ""} className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Nouveau mot de passe
              <Input name="password" type="password" placeholder="Optionnel" className="mt-2" />
            </label>
            <label className="text-sm font-medium text-slate-900">
              Role
              <select
                name="role"
                defaultValue={user.role}
                className="mt-2 h-9 rounded-md border border-border bg-white px-3 text-sm"
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-900">
              Commune d&apos;accès
              <select
                name="communeId"
                defaultValue={user.communeId ?? ""}
                className="mt-2 h-9 rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="">Toutes les communes</option>
                {communes.map((commune) => (
                  <option key={commune.id} value={commune.id}>
                    {commune.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-slate-900">
              Superieur hierarchique
              <select
                name="supervisorId"
                defaultValue={user.supervisorId ?? ""}
                className="mt-2 h-9 rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value="">Aucun</option>
                {supervisors
                  .filter((supervisor) => supervisor.id !== user.id)
                  .map((supervisor) => (
                    <option key={supervisor.id} value={supervisor.id}>
                      {supervisor.name ?? supervisor.email} · {supervisor.role}
                      {supervisor.commune?.name ? ` · ${supervisor.commune.name}` : " · Global"}
                    </option>
                  ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <div className="text-sm font-semibold text-slate-900">Modules visibles</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cochez les modules auxquels cet utilisateur peut acceder.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {MODULES.map((module) => (
                  <label
                    key={module.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="modules"
                      value={module.id}
                      defaultChecked={enabled.has(module.id)}
                      className="h-4 w-4"
                    />
                    <span>{module.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <Button type="submit" className="md:w-48">
                Sauvegarder
              </Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
