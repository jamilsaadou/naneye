import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import Link from "next/link";
import { Building2, Globe2, Info, List, Pencil, PlusCircle, Settings, Sparkles, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { createTaxpayerGroup, deleteTaxpayerGroup, updateTaxpayerGroup } from "./actions";

export default async function TaxpayerGroupsPage() {
  const user = await getUserWithCommune();
  if (!user) {
    return <div className="text-sm text-muted-foreground">Acces refuse.</div>;
  }

  const scopedCommuneId = user.role === "SUPER_ADMIN" ? null : user.commune?.id ?? null;
  const scopedCommuneName = user.role === "SUPER_ADMIN" ? null : user.commune?.name ?? null;

  const [communes, groups] = await Promise.all([
    prisma.commune.findMany({ orderBy: { name: "asc" } }),
    prisma.taxpayerGroup.findMany({
      where: scopedCommuneId
        ? {
            OR: [{ isGlobal: true }, { communes: { some: { id: scopedCommuneId } } }],
          }
        : undefined,
      orderBy: { name: "asc" },
      include: { communes: { select: { id: true, name: true } }, _count: { select: { taxpayers: true } } },
    }),
  ]);

  const totalGroups = groups.length;
  const globalGroups = groups.filter((group) => group.isGlobal).length;
  const multiCommuneGroups = groups.filter((group) => !group.isGlobal && group.communes.length > 1).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-emerald-100/70 bg-gradient-to-br from-emerald-50 via-white to-white px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Organisation
              </div>
              <h1 className="text-2xl font-semibold">Groupes de contribuables</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Regroupez les contribuables pour filtrer les avis, rapports et generations.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="flex items-center gap-1 border-emerald-200 bg-white/80 text-emerald-700">
                  <Users className="h-3.5 w-3.5" />
                  {totalGroups} groupes
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 border-slate-200 bg-white/80 text-slate-600">
                  <Globe2 className="h-3.5 w-3.5" />
                  {globalGroups} globaux
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1 border-amber-200 bg-white/80 text-amber-700">
                  <Building2 className="h-3.5 w-3.5" />
                  {multiCommuneGroups} multi-communes
                </Badge>
                {scopedCommuneName ? (
                  <Badge variant="outline" className="flex items-center gap-1 border-slate-200 bg-white/80 text-slate-600">
                    <Building2 className="h-3.5 w-3.5" />
                    {scopedCommuneName}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
          <Button asChild variant="outline">
            <Link href="/taxpayers">Retour</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <PlusCircle className="h-5 w-5 text-emerald-600" />
            Créer un groupe
          </div>
          <p className="text-sm text-muted-foreground">
            Définissez les communes cibles ou un groupe global pour tout le territoire.
          </p>
        </CardHeader>
        <CardContent>
          <ActionForm action={createTaxpayerGroup} className="grid gap-3 md:grid-cols-6" successMessage="Groupe créé.">
            {scopedCommuneName ? (
              <div className="md:col-span-3 rounded-md border border-border bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <span className="flex items-center gap-2 font-medium text-slate-700">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Commune
                </span>
                <div className="mt-1">{scopedCommuneName}</div>
              </div>
            ) : (
              <label className="md:col-span-3 text-xs font-medium text-slate-700">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  Communes
                </span>
                <div className="mt-2 grid max-h-40 gap-2 overflow-auto rounded-md border border-border bg-white p-3 md:grid-cols-2 lg:grid-cols-3">
                  {communes.map((commune) => (
                    <label key={commune.id} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        name="communes"
                        value={commune.id}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span>{commune.name}</span>
                    </label>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Cochez une ou plusieurs communes. Si le groupe est global, cette sélection est ignorée.
                </div>
              </label>
            )}
            {!scopedCommuneName ? (
              <label className="md:col-span-3 flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-700">
                <input type="checkbox" name="isGlobal" className="h-4 w-4" />
                <Globe2 className="h-4 w-4 text-slate-500" />
                Groupe global (toutes communes)
              </label>
            ) : null}
            <label className="md:col-span-2 text-xs font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Nom du groupe
              </span>
              <Input name="name" placeholder="Nom du groupe" required className="mt-2" />
            </label>
            <label className="md:col-span-2 text-xs font-medium text-slate-700">
              <span className="flex items-center gap-2">
                <Info className="h-4 w-4 text-slate-500" />
                Description
              </span>
              <Input name="description" placeholder="Description (optionnel)" className="mt-2" />
            </label>
            <Button type="submit" className="md:col-span-2 md:self-end">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 text-lg font-semibold">
            <List className="h-5 w-5 text-slate-600" />
            Liste des groupes
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-slate-500" />
                    Communes
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    Groupe
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-slate-500" />
                    Description
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-500" />
                    Contribuables
                  </span>
                </TableHead>
                <TableHead>
                  <span className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-slate-500" />
                    Actions
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const communeLabel = group.isGlobal
                  ? "Toutes communes"
                  : group.communes.map((commune) => commune.name).join(", ") || "-";
                const groupTypeLabel = group.isGlobal
                  ? "Global"
                  : group.communes.length > 1
                    ? "Multi-communes"
                    : "Commune unique";
                const groupTypeClass = group.isGlobal
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : group.communes.length > 1
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-600";
                const canManage =
                  !scopedCommuneId ||
                  (!group.isGlobal &&
                    group.communes.length === 1 &&
                    group.communes[0]?.id === scopedCommuneId);
                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-slate-900">{communeLabel}</div>
                        <Badge variant="outline" className={`text-xs ${groupTypeClass}`}>
                          {groupTypeLabel}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{group.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {group.communes.length} commune{group.communes.length > 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-slate-600">{group.description ?? "-"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                        <Users className="h-4 w-4 text-slate-500" />
                        {group._count.taxpayers}
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <div className="flex flex-wrap gap-2">
                          <details className="relative">
                            <summary className="flex cursor-pointer items-center gap-2 text-sm text-primary">
                              <Pencil className="h-3.5 w-3.5" />
                              Modifier
                            </summary>
                            <ActionForm
                              action={updateTaxpayerGroup}
                              className="absolute right-0 z-10 mt-2 w-80 rounded-md border bg-white p-3 shadow-lg"
                              successMessage="Groupe mis à jour."
                            >
                              <input type="hidden" name="id" value={group.id} />
                              <div className="space-y-2">
                                {scopedCommuneName ? (
                                  <div className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                    {scopedCommuneName}
                                  </div>
                                ) : (
                                  <>
                                    <label className="text-xs font-medium text-slate-700">
                                      Communes
                                      <select
                                        name="communes"
                                        multiple
                                        defaultValue={group.communes.map((commune) => commune.id)}
                                        className="mt-2 h-24 w-full rounded-md border border-border bg-white px-3 text-sm"
                                      >
                                        {communes.map((commune) => (
                                          <option key={commune.id} value={commune.id}>
                                            {commune.name}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <label className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs text-slate-700">
                                      <input
                                        type="checkbox"
                                        name="isGlobal"
                                        defaultChecked={group.isGlobal}
                                        className="h-4 w-4"
                                      />
                                      Groupe global (toutes communes)
                                    </label>
                                  </>
                                )}
                                <Input name="name" defaultValue={group.name} required />
                                <Input name="description" defaultValue={group.description ?? ""} placeholder="Description" />
                                <Button type="submit" className="w-full">
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Sauvegarder
                                </Button>
                              </div>
                            </ActionForm>
                          </details>
                          <ActionForm action={deleteTaxpayerGroup} successMessage="Groupe supprimé.">
                            <input type="hidden" name="id" value={group.id} />
                            <Button type="submit" variant="outline" size="sm">
                              <Trash2 className="mr-2 h-4 w-4 text-rose-500" />
                              Supprimer
                            </Button>
                          </ActionForm>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Gestion réservée au super admin.</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {groups.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Aucun groupe configuré.
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
