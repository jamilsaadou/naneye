import { prisma } from "@/lib/prisma";
import { getUserWithCommune } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/ui/action-form";
import { updateTaxpayer, updateTaxpayerMeasures } from "../actions";
import { OsmLocation } from "@/components/ui/osm-location";

const SALUBRITE_CODE = "SALUBRITE";
const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: "En attente",
  ACTIVE: "Approuvé",
  ARCHIVED: "Archivé",
};

const AUDIT_FIELD_LABELS: Array<[string, string]> = [
  ["name", "Nom"],
  ["category", "Catégorie"],
  ["commune", "Commune"],
  ["neighborhood", "Quartier"],
  ["groupId", "Groupe"],
  ["status", "Statut"],
  ["address", "Adresse"],
  ["phone", "Téléphone"],
  ["email", "Email"],
  ["startedAt", "Début d'exercice"],
];

const ACTION_LABELS: Record<string, string> = {
  TAXPAYER_CREATED: "Création du contribuable",
  TAXPAYER_UPDATED: "Mise à jour du contribuable",
  TAXPAYER_APPROVED: "Approbation du contribuable",
  TAXPAYER_ARCHIVED: "Archivage du contribuable",
  TAXPAYER_DELETED: "Suppression du contribuable",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeCompareValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  if (key === "startedAt") {
    const date = new Date(value as string);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  return String(value);
}

function formatAuditValue(key: string, value: unknown, groupNameById: Map<string, string>) {
  if (value === null || value === undefined || value === "") {
    return key === "groupId" ? "Aucun" : "—";
  }
  if (key === "status" && typeof value === "string") {
    return STATUS_LABELS[value] ?? value;
  }
  if (key === "groupId") {
    if (typeof value === "string") {
      return groupNameById.get(value) ?? value;
    }
    return "Aucun";
  }
  if (key === "startedAt") {
    const date = new Date(value as string);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString("fr-FR");
    }
  }
  return String(value);
}

function buildAuditDetails(
  log: { action: string; before: unknown; after: unknown },
  groupNameById: Map<string, string>,
) {
  const before = isRecord(log.before) ? log.before : null;
  const after = isRecord(log.after) ? log.after : null;
  const items: Array<{ label: string; from?: string; to?: string; value?: string }> = [];

  if (before && after) {
    for (const [key, label] of AUDIT_FIELD_LABELS) {
      const beforeValue = normalizeCompareValue(key, before[key]);
      const afterValue = normalizeCompareValue(key, after[key]);
      if (beforeValue === afterValue) continue;
      items.push({
        label,
        from: formatAuditValue(key, before[key], groupNameById),
        to: formatAuditValue(key, after[key], groupNameById),
      });
    }
    return { label: "Changements", items };
  }

  const source = after ?? before;
  if (source) {
    for (const [key, label] of AUDIT_FIELD_LABELS) {
      const value = formatAuditValue(key, source[key], groupNameById);
      if (value === "—") continue;
      items.push({ label, value });
    }
  }

  const detailLabel = after ? "Données créées" : "Dernier état connu";
  return { label: detailLabel, items };
}

export default async function TaxpayerDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserWithCommune();
  const scopedCommuneId = user?.role === "SUPER_ADMIN" ? null : user?.communeId ?? null;
  const scopedCommuneName = user?.role === "SUPER_ADMIN" ? null : user?.commune?.name ?? null;
  const taxpayer = await prisma.taxpayer.findUnique({
    where: { id },
    include: {
      measures: true,
      notices: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!taxpayer) {
    return <div className="text-sm text-muted-foreground">Contribuable introuvable.</div>;
  }
  if (scopedCommuneName && taxpayer.commune !== scopedCommuneName) {
    return <div className="text-sm text-muted-foreground">Accès refusé pour cette commune.</div>;
  }

  const [taxes, categories, communes, neighborhoods, groups] = await Promise.all([
    prisma.tax.findMany({ where: { active: true }, orderBy: { label: "asc" } }),
    prisma.taxpayerCategory.findMany({ orderBy: { label: "asc" } }),
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
  const auditLogs = await prisma.auditLog.findMany({
    where: { entityType: "TAXPAYER", entityId: taxpayer.id },
    include: { actor: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  const measureTaxes = taxes.filter((tax) => tax.code.toUpperCase() !== SALUBRITE_CODE);
  const measuresByTaxId = new Map(taxpayer.measures.map((measure) => [measure.taxId, measure.quantity]));
  const latestNotice = taxpayer.notices[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{taxpayer.name}</h1>
        <p className="text-sm text-muted-foreground">
          Code contribuable {taxpayer.code ?? taxpayer.id.slice(0, 8).toUpperCase()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Modifier le contribuable</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={updateTaxpayer}
            className="grid gap-4 md:grid-cols-3"
            successMessage="Contribuable mis à jour."
          >
            <input type="hidden" name="id" value={taxpayer.id} />
            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Nom de l’établissement *
                <Input name="name" defaultValue={taxpayer.name} required className="mt-2" />
              </label>
              <label className="text-sm font-medium text-slate-900">
                Numéro de téléphone *
                <Input name="phone" defaultValue={taxpayer.phone} required className="mt-2" />
              </label>
              <label className="text-sm font-medium text-slate-900">
                E-mail
                <Input name="email" type="email" defaultValue={taxpayer.email ?? ""} className="mt-2" />
              </label>
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Catégorie *
                <select
                  name="category"
                  required
                  defaultValue={taxpayer.category ?? ""}
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Choisir la catégorie</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.label}>
                      {cat.label} ({cat.code ?? "-"})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-slate-900">
                Groupe
                <select
                  name="groupId"
                  defaultValue={taxpayer.groupId ?? ""}
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
                      <Input
                        name="photoUrl"
                        defaultValue={taxpayer.photoUrl ?? ""}
                        placeholder="URL de photo (optionnel)"
                        className="mt-2"
                      />
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
                  defaultValue={taxpayer.comment ?? ""}
                  className="mt-2 h-44 w-full rounded-md border border-border bg-white p-3 text-sm"
                />
              </label>
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Commune *
                <select
                  name="commune"
                  defaultValue={taxpayer.commune}
                  required
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
                  defaultValue={taxpayer.neighborhood}
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
                <Input name="address" defaultValue={taxpayer.address ?? ""} className="mt-2" />
              </label>
            </div>

            <div className="md:col-span-3">
              <OsmLocation
                initialLat={taxpayer.latitude ? taxpayer.latitude.toString() : ""}
                initialLon={taxpayer.longitude ? taxpayer.longitude.toString() : ""}
              />
            </div>

            <div className="md:col-span-3 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-900">
                Date de début des opérations *
                <Input
                  name="startedAt"
                  type="date"
                  defaultValue={taxpayer.startedAt ? taxpayer.startedAt.toISOString().slice(0, 10) : ""}
                  className="mt-2"
                />
              </label>
              <label className="text-sm font-medium text-slate-900">
                Statut
                <select
                  name="status"
                  defaultValue={taxpayer.status}
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="ACTIVE">Approuvé</option>
                  <option value="ARCHIVED">Archivé</option>
                </select>
              </label>
            </div>

            <Button type="submit" className="md:w-48">
              Sauvegarder
            </Button>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Historique des modifications</h2>
        </CardHeader>
        <CardContent>
          {auditLogs.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucune modification enregistrée.</div>
          ) : (
            <div className="space-y-3 text-sm">
              {auditLogs.map((log) => {
                const details = buildAuditDetails(log, groupNameById);
                const actionLabel = ACTION_LABELS[log.action] ?? log.action;
                const actorLabel = log.actor?.name ?? log.actor?.email ?? "Système";
                return (
                  <div key={log.id} className="rounded-xl border border-border/60 bg-white/80 p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{actionLabel}</div>
                        <div className="text-xs text-muted-foreground">Par {actorLabel}</div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                    {details.items.length > 0 ? (
                      <div className="mt-3 rounded-lg border border-border/60 bg-slate-50/80 p-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                          {details.label}
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-slate-700">
                          {details.items.map((item) => (
                            <div key={`${log.id}-${item.label}`} className="flex flex-wrap gap-2">
                              <span className="font-medium text-slate-800">{item.label}:</span>
                              {item.from !== undefined && item.to !== undefined ? (
                                <span className="text-slate-600">
                                  {item.from} → {item.to}
                                </span>
                              ) : (
                                <span className="text-slate-600">{item.value}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-muted-foreground">Aucun détail enregistré.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Mesures par taxe</h2>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={updateTaxpayerMeasures}
            className="grid gap-3"
            successMessage="Mesures mises à jour."
          >
            <input type="hidden" name="taxpayerId" value={taxpayer.id} />
            {measureTaxes.length === 0 ? (
              <div className="text-xs text-muted-foreground">Aucune taxe active nécessitant des mesures.</div>
            ) : (
              measureTaxes.map((tax) => (
                <div key={tax.id} className="grid gap-2 md:grid-cols-3">
                  <div className="text-sm text-slate-700">
                    {tax.label} ({tax.code})
                    <div className="text-xs text-muted-foreground">Montant unitaire: {tax.rate.toString()}</div>
                  </div>
                  <Input
                    name={`measure_${tax.id}`}
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={measuresByTaxId.get(tax.id)?.toString() ?? ""}
                  />
                </div>
              ))
            )}
            <Button type="submit" className="md:w-48">
              Mettre a jour
            </Button>
          </ActionForm>
        </CardContent>
      </Card>
    </div>
  );
}
