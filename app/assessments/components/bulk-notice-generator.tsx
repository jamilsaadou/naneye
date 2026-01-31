"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import {
  AlertTriangle,
  Archive,
  CalendarRange,
  CheckCircle,
  Download,
  Layers,
  MapPin,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const START_YEAR = 2025;

type CategoryOption = { id: string; label: string };

type CommuneOption = { id: string; name: string };

type NeighborhoodOption = { id: string; name: string; communeName: string };

type GroupOption = { id: string; name: string; isGlobal: boolean; communes: Array<{ id: string; name: string }> };

type BulkResult = {
  ok: boolean;
  message?: string;
  matched?: number;
  generated?: number;
  existing?: number;
  failed?: number;
  skippedMissingStartedAt?: number;
  errors?: Array<{ name: string; message: string }>;
};

type DownloadState = {
  status: "idle" | "starting" | "downloading" | "done" | "error";
  progress: number | null;
  message?: string;
};

type BulkNoticeGeneratorProps = {
  categories: CategoryOption[];
  communes: CommuneOption[];
  neighborhoods: NeighborhoodOption[];
  groups: GroupOption[];
  scopedCommune?: string | null;
  defaultYear: number;
};

function buildYearOptions(currentYear: number) {
  const endYear = Math.max(currentYear, START_YEAR) + 5;
  return Array.from({ length: endYear - START_YEAR + 1 }).map((_, index) => START_YEAR + index);
}

function getDownloadFilename(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    return decodeURIComponent(utfMatch[1]);
  }
  const match = disposition.match(/filename=\"?([^\";]+)\"?/i);
  if (match?.[1]) return match[1];
  return fallback;
}

export function BulkNoticeGenerator({
  categories,
  communes,
  neighborhoods,
  groups,
  scopedCommune,
  defaultYear,
}: BulkNoticeGeneratorProps) {
  const [scope, setScope] = useState(scopedCommune ? "COMMUNE" : "GLOBAL");
  const [category, setCategory] = useState("");
  const [commune, setCommune] = useState(scopedCommune ?? "");
  const [neighborhood, setNeighborhood] = useState("");
  const [groupId, setGroupId] = useState("");
  const [startedFrom, setStartedFrom] = useState("");
  const [startedTo, setStartedTo] = useState("");
  const [year, setYear] = useState(String(defaultYear));
  const [result, setResult] = useState<BulkResult | null>(null);
  const [downloadState, setDownloadState] = useState<DownloadState>({ status: "idle", progress: null });
  const [isPending, startTransition] = useTransition();

  const yearOptions = useMemo(() => buildYearOptions(defaultYear), [defaultYear]);

  const neighborhoodsForCommune = useMemo(() => {
    if (!commune) return neighborhoods;
    return neighborhoods.filter((item) => item.communeName === commune);
  }, [commune, neighborhoods]);

  const groupsForCommune = useMemo(() => {
    const scope = scopedCommune ?? commune;
    if (scope) {
      return groups.filter(
        (group) => group.isGlobal || group.communes.some((item) => item.name === scope),
      );
    }
    return groups;
  }, [commune, groups, scopedCommune]);

  useEffect(() => {
    if (scopedCommune) {
      setCommune(scopedCommune);
    }
  }, [scopedCommune]);

  useEffect(() => {
    if (scope === "GLOBAL" && !scopedCommune) {
      setCommune("");
    }
  }, [scope, scopedCommune]);

  useEffect(() => {
    if (!neighborhood) return;
    const exists = neighborhoodsForCommune.some((item) => item.name === neighborhood);
    if (!exists) {
      setNeighborhood("");
    }
  }, [neighborhood, neighborhoodsForCommune]);

  useEffect(() => {
    if (!groupId) return;
    const exists = groupsForCommune.some((group) => group.id === groupId);
    if (!exists) {
      setGroupId("");
    }
  }, [groupId, groupsForCommune]);

  useEffect(() => {
    if (scope !== "NEIGHBORHOOD" && neighborhood) {
      setNeighborhood("");
    }
  }, [scope, neighborhood]);

  const scopeRequiresCommune = scope === "COMMUNE" || scope === "NEIGHBORHOOD";
  const scopeRequiresNeighborhood = scope === "NEIGHBORHOOD";
  const isScopeValid = (!scopeRequiresCommune || Boolean(commune)) && (!scopeRequiresNeighborhood || Boolean(neighborhood));

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams();
    params.set("year", year);
    params.set("scope", scope);
    if (category) params.set("category", category);
    if (commune) params.set("commune", commune);
    if (neighborhood) params.set("neighborhood", neighborhood);
    if (groupId) params.set("groupId", groupId);
    if (startedFrom) params.set("startedFrom", startedFrom);
    if (startedTo) params.set("startedTo", startedTo);
    return `/api/assessments/bulk-download?${params.toString()}`;
  }, [year, scope, category, commune, neighborhood, groupId, startedFrom, startedTo]);

  const handleGenerate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isScopeValid) {
      setResult({ ok: false, message: "Completez la commune ou le quartier requis." });
      return;
    }

    startTransition(async () => {
      setResult(null);
      try {
        const csrfToken = document.cookie
          .split(";")
          .map((part) => part.trim())
          .find((part) => part.startsWith("csrf_token="))
          ?.split("=")[1];

        const response = await fetch("/api/assessments/bulk-generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken ? { "x-csrf-token": decodeURIComponent(csrfToken) } : {}),
          },
          body: JSON.stringify({
            scope,
            category,
            commune,
            neighborhood,
            groupId,
            startedFrom,
            startedTo,
            year,
          }),
        });

        const data = (await response.json()) as BulkResult & { message?: string };
        if (!response.ok) {
          setResult({ ok: false, message: data.message ?? "Erreur de génération." });
          return;
        }
        setResult(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur de génération.";
        setResult({ ok: false, message });
      }
    });
  };

  const canDownload = isScopeValid && Boolean(year);

  const handleDownload = async () => {
    if (!canDownload || downloadState.status === "starting" || downloadState.status === "downloading") {
      return;
    }
    setDownloadState({ status: "starting", progress: null });
    try {
      const response = await fetch(downloadHref);
      if (!response.ok) {
        let message = "Erreur de téléchargement.";
        try {
          const data = (await response.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          // ignore json parse errors
        }
        setDownloadState({ status: "error", progress: null, message });
        return;
      }

      const totalLength = response.headers.get("content-length");
      const total = totalLength ? Number.parseInt(totalLength, 10) : 0;
      const contentType = response.headers.get("content-type") ?? "application/zip";
      const fallbackName = `avis-imposition-${year}.zip`;
      const filename = getDownloadFilename(response.headers.get("content-disposition"), fallbackName);

      if (!response.body) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(new Blob([blob], { type: contentType }));
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        setDownloadState({ status: "done", progress: 100 });
        return;
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      setDownloadState({ status: "downloading", progress: total ? 0 : null });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          if (total > 0) {
            const percent = Math.min(100, Math.round((received / total) * 100));
            setDownloadState({ status: "downloading", progress: percent });
          }
        }
      }

      const blob = new Blob(chunks, { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setDownloadState({ status: "done", progress: 100 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur de téléchargement.";
      setDownloadState({ status: "error", progress: null, message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Ciblage intelligent
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Filtrez par categorie, commune ou quartier. Le systeme tient compte du debut d&apos;exercice.
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarRange className="h-4 w-4 text-slate-600" />
            Periode d&apos;exercice
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Selectionnez une periode pour isoler les contribuables concernes.
          </p>
        </div>
        <div className="rounded-lg border bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Archive className="h-4 w-4 text-slate-600" />
            Export ZIP
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Telechargez un pack PDF (un avis par contribuable).
          </p>
        </div>
      </div>

      <form onSubmit={handleGenerate} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500" />
              Portee
            </span>
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="GLOBAL">Global</option>
              <option value="COMMUNE">Par commune</option>
              <option value="NEIGHBORHOOD">Par quartier</option>
            </select>
          </label>
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              Commune
            </span>
            <select
              value={commune}
              onChange={(event) => setCommune(event.target.value)}
              disabled={Boolean(scopedCommune) || !scopeRequiresCommune}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="">Toutes les communes</option>
              {communes.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-slate-500" />
              Quartier
            </span>
            <select
              value={neighborhood}
              onChange={(event) => setNeighborhood(event.target.value)}
              disabled={!scopeRequiresNeighborhood}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="">Tous les quartiers</option>
              {neighborhoodsForCommune.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              Categorie
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="">Toutes les categories</option>
              {categories.map((item) => (
                <option key={item.id} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-slate-500" />
              Annee d&apos;imposition
            </span>
            <select
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              {yearOptions.map((value) => (
                <option key={value} value={String(value)}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-slate-500" />
              Debut d&apos;exercice (du)
            </span>
            <Input value={startedFrom} onChange={(event) => setStartedFrom(event.target.value)} type="date" className="mt-2" />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-slate-500" />
              Debut d&apos;exercice (au)
            </span>
            <Input value={startedTo} onChange={(event) => setStartedTo(event.target.value)} type="date" className="mt-2" />
          </label>
          <label className="text-sm font-medium text-slate-900">
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-500" />
              Groupe
            </span>
            <select
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
              className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
            >
              <option value="">Tous les groupes</option>
              {groupsForCommune.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                  {group.isGlobal
                    ? " · Toutes communes"
                    : !scopedCommune && !commune
                      ? ` · ${group.communes.map((item) => item.name).join(", ")}`
                      : ""}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2 flex flex-wrap items-end gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Génération en cours..." : "Générer les avis"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!canDownload || downloadState.status === "starting" || downloadState.status === "downloading"}
              onClick={handleDownload}
            >
              <Download className="mr-2 h-4 w-4" />
              Télécharger le ZIP
            </Button>
            {scopedCommune ? <Badge variant="outline">Commune: {scopedCommune}</Badge> : null}
          </div>
        </div>
      </form>

      {downloadState.status !== "idle" ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-slate-900">
              {downloadState.status === "starting" && "Préparation du téléchargement..."}
              {downloadState.status === "downloading" && "Téléchargement en cours..."}
              {downloadState.status === "done" && "Téléchargement terminé."}
              {downloadState.status === "error" && (downloadState.message ?? "Erreur de téléchargement.")}
            </div>
            {downloadState.status === "downloading" && downloadState.progress !== null ? (
              <span className="text-xs text-muted-foreground">{downloadState.progress}%</span>
            ) : null}
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            {downloadState.status === "downloading" && downloadState.progress !== null ? (
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${downloadState.progress}%` }}
              />
            ) : downloadState.status === "done" ? (
              <div className="h-full w-full bg-emerald-500" />
            ) : downloadState.status === "error" ? (
              <div className="h-full w-full bg-rose-400" />
            ) : (
              <div className="h-full w-1/2 animate-pulse bg-emerald-300" />
            )}
          </div>
        </div>
      ) : null}

      {result ? (
        <div
          className={`rounded-lg border p-4 text-sm ${
            result.ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {result.ok ? (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            )}
            <span>{result.message ?? (result.ok ? "Génération terminée." : "Erreur de génération.")}</span>
          </div>
          {result.ok ? (
            <div className="mt-3 grid gap-2 md:grid-cols-5">
              <div>
                <span className="text-xs text-muted-foreground">Contribuables cibles</span>
                <div className="font-semibold text-slate-900">{result.matched ?? 0}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Avis créés</span>
                <div className="font-semibold text-slate-900">{result.generated ?? 0}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Avis existants</span>
                <div className="font-semibold text-slate-900">{result.existing ?? 0}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Debut d&apos;exercice manquant</span>
                <div className="font-semibold text-slate-900">{result.skippedMissingStartedAt ?? 0}</div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Erreurs</span>
                <div className="font-semibold text-slate-900">{result.failed ?? 0}</div>
              </div>
            </div>
          ) : null}
          {result.errors && result.errors.length > 0 ? (
            <div className="mt-3 space-y-1 text-xs text-rose-700">
              {result.errors.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  {item.name}: {item.message}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
