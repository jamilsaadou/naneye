import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ActionForm } from "@/components/ui/action-form";
import { createTaxpayer } from "../actions";
import { OsmLocation } from "@/components/ui/osm-location";

const SALUBRITE_CODE = "SALUBRITE";

export default async function NewTaxpayerPage() {
  const user = await getUserWithCommune();
  const scopedCommuneId = user?.role === "SUPER_ADMIN" ? null : user?.communeId ?? null;
  const scopedCommuneName = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;
  const [categories, taxes, communes, neighborhoods, groups] = await Promise.all([
    prisma.taxpayerCategory.findMany({ orderBy: { label: "asc" } }),
    prisma.tax.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    prisma.commune.findMany({
      where: scopedCommuneId ? { id: scopedCommuneId } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.neighborhood.findMany({
      where: scopedCommuneId ? { communeId: scopedCommuneId } : undefined,
      orderBy: { name: "asc" },
    }),
    prisma.taxpayerGroup.findMany({
      where: scopedCommuneId
        ? { OR: [{ isGlobal: true }, { communes: { some: { id: scopedCommuneId } } }] }
        : undefined,
      orderBy: { name: "asc" },
      include: { communes: { select: { name: true } } },
    }),
  ]);
  const measureTaxes = taxes.filter((tax) => tax.code.toUpperCase() !== SALUBRITE_CODE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Enregistrer le contribuable</h1>
          <p className="text-sm text-muted-foreground">Informations d’identification et taxes associées.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/taxpayers">Dos</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Identité du contribuable</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={createTaxpayer}
            className="grid gap-4 md:grid-cols-3"
            successMessage="Contribuable enregistré."
          >
            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Nom de l’établissement *
                <Input name="name" required className="mt-2" />
              </label>
              <label className="text-sm font-medium text-slate-900">
                Numéro de téléphone *
                <Input name="phone" required className="mt-2" />
              </label>
              <label className="text-sm font-medium text-slate-900">
                E-mail
                <Input name="email" type="email" className="mt-2" />
              </label>
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Catégorie *
                <select
                  name="category"
                  required
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Choisir la catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.label}>
                      {category.label} ({category.code ?? "-"}, salubrité {category.sanitationAmount.toString()})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-900">
                Groupe
                <select
                  name="groupId"
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Aucun groupe</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                      {group.isGlobal
                        ? " · Toutes communes"
                        : !scopedCommuneName
                          ? ` · ${group.communes.map((item) => item.name).join(", ")}`
                          : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-900">
                Photos
                <div className="mt-2 flex h-44 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  <div className="text-center">
                    <div>Faites glisser les fichiers ici</div>
                    <div className="mt-2">
                      <Input name="photoFiles" type="file" accept="image/*" multiple />
                      <Input name="photoUrl" placeholder="URL de photo (optionnel)" className="mt-2" />
                    </div>
                  </div>
                </div>
              </label>
            </div>
            <div className="md:col-span-1">
              <label className="text-sm font-medium text-slate-900">
                Commentaire
                <textarea
                  name="comment"
                  className="mt-2 h-44 w-full rounded-md border border-border bg-white p-3 text-sm"
                />
              </label>
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Commune *
                <select
                  name="commune"
                  required
                  defaultValue={scopedCommuneName ?? ""}
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  {!scopedCommuneName && <option value="">Choisir la commune</option>}
                  {communes.map((commune) => (
                    <option key={commune.id} value={commune.name}>
                      {commune.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-900">
                Quartier *
                <select
                  name="neighborhood"
                  required
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Choisir le quartier</option>
                  {neighborhoods.map((neighborhood) => (
                    <option key={neighborhood.id} value={neighborhood.name}>
                      {neighborhood.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-900">
                Adresse
                <Input name="address" className="mt-2" />
              </label>
            </div>

            <div className="md:col-span-3">
              <OsmLocation />
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Date de début des opérations *
                <Input name="startedAt" type="date" required className="mt-2" />
              </label>
            </div>

            <div className="md:col-span-3">
              <div className="text-sm font-semibold text-slate-900">Mesures par taxe</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Saisissez les mesures unitaires pour chaque taxe active (hors salubrité).
              </p>
            </div>
            {measureTaxes.length === 0 ? (
              <div className="md:col-span-3 text-xs text-muted-foreground">
                Aucune taxe active nécessitant des mesures.
              </div>
            ) : (
              measureTaxes.map((tax) => (
                <div key={tax.id} className="md:col-span-3 grid gap-2 md:grid-cols-3">
                  <div className="text-sm text-slate-700">
                    {tax.label} ({tax.code})
                    <div className="text-xs text-muted-foreground">Montant unitaire: {tax.rate.toString()}</div>
                  </div>
                  <Input
                    name={`measure_${tax.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Mesure"
                  />
                </div>
              ))
            )}
            <div className="md:col-span-3 flex items-center justify-end gap-3">
              <Button type="submit">Enregistrer</Button>
            </div>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
