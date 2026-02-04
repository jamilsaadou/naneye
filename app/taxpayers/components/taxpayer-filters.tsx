"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CommuneOption = {
  id: string;
  name: string;
};

type NeighborhoodOption = {
  id: string;
  name: string;
  communeName: string;
};

type CategoryOption = {
  id: string;
  label: string;
};

type GroupOption = {
  id: string;
  name: string;
  isGlobal: boolean;
  communes: Array<{ id: string; name: string }>;
};

type TaxpayerFilterValues = {
  q: string;
  neighborhood: string;
  commune: string;
  status: string;
  category: string;
  groupId: string;
};

type TaxpayerFiltersProps = {
  accessibleCommunes?: string[] | null; // null = toutes, [] = aucune, [...] = liste
  communeOptions: CommuneOption[];
  neighborhoodOptions: NeighborhoodOption[];
  categoryOptions: CategoryOption[];
  groupOptions: GroupOption[];
  initialValues: TaxpayerFilterValues;
};

export function TaxpayerFilters({
  accessibleCommunes,
  communeOptions,
  neighborhoodOptions,
  categoryOptions,
  groupOptions,
  initialValues,
}: TaxpayerFiltersProps) {
  // Si une seule commune accessible, elle est automatiquement sélectionnée
  const singleCommune = accessibleCommunes && accessibleCommunes.length === 1 ? accessibleCommunes[0] : null;
  const canSelectCommune = accessibleCommunes === null || (accessibleCommunes && accessibleCommunes.length > 1);

  const [commune, setCommune] = useState(singleCommune ?? initialValues.commune ?? "");
  const [neighborhood, setNeighborhood] = useState(initialValues.neighborhood ?? "");
  const [q, setQ] = useState(initialValues.q ?? "");
  const [status, setStatus] = useState(initialValues.status ?? "");
  const [category, setCategory] = useState(initialValues.category ?? "");
  const [groupId, setGroupId] = useState(initialValues.groupId ?? "");

  useEffect(() => {
    if (singleCommune) {
      setCommune(singleCommune);
    }
  }, [singleCommune]);

  const filteredNeighborhoods = useMemo(() => {
    const base = singleCommune
      ? neighborhoodOptions.filter((item) => item.communeName === singleCommune)
      : commune
        ? neighborhoodOptions.filter((item) => item.communeName === commune)
        : neighborhoodOptions;

    return [...base].sort((a, b) => {
      if (!singleCommune && !commune) {
        const communeCompare = a.communeName.localeCompare(b.communeName, "fr");
        if (communeCompare !== 0) return communeCompare;
      }
      return a.name.localeCompare(b.name, "fr");
    });
  }, [commune, neighborhoodOptions, singleCommune]);

  const filteredGroups = useMemo(() => {
    const scope = singleCommune ?? commune;
    if (scope) {
      return groupOptions.filter(
        (group) => group.isGlobal || group.communes.some((item) => item.name === scope),
      );
    }
    return groupOptions;
  }, [commune, groupOptions, singleCommune]);

  useEffect(() => {
    if (!neighborhood) return;
    const exists = filteredNeighborhoods.some((item) => item.name === neighborhood);
    if (!exists) {
      setNeighborhood("");
    }
  }, [filteredNeighborhoods, neighborhood]);

  useEffect(() => {
    if (!groupId) return;
    const exists = filteredGroups.some((item) => item.id === groupId);
    if (!exists) {
      setGroupId("");
    }
  }, [filteredGroups, groupId]);

  const neighborhoodDisabled = singleCommune ? false : !commune;
  const groupDisabled = filteredGroups.length === 0;

  return (
    <form className={`grid gap-3 ${!canSelectCommune ? "md:grid-cols-3" : "md:grid-cols-4"}`} method="get">
      <label className="text-sm font-medium text-slate-900">
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-500" />
          Recherche
        </span>
        <Input
          name="q"
          placeholder="Code, nom, téléphone"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="mt-2 bg-slate-50"
        />
      </label>
      {!canSelectCommune ? (
        <label className="text-sm font-medium text-slate-900">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            Commune
          </span>
          <div className="mt-2 flex h-9 items-center rounded-md border border-border bg-slate-50 px-3 text-sm text-slate-600">
            {singleCommune ?? "Aucune commune"}
          </div>
        </label>
      ) : (
        <label className="text-sm font-medium text-slate-900">
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-slate-500" />
            Commune
          </span>
          <select
            name="commune"
            value={commune}
            onChange={(event) => setCommune(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-border bg-slate-50 px-3 text-sm"
          >
            <option value="">Toutes les communes</option>
            {communeOptions.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="text-sm font-medium text-slate-900">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-slate-500" />
          Quartier
        </span>
        <select
          name="neighborhood"
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          disabled={neighborhoodDisabled}
          className="mt-2 h-9 w-full rounded-md border border-border bg-slate-50 px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">
            {neighborhoodDisabled ? "Choisir une commune d'abord" : "Tous les quartiers"}
          </option>
          {filteredNeighborhoods.map((item) => (
            <option key={item.id} value={item.name}>
              {!singleCommune && !commune ? `${item.communeName} · ${item.name}` : item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-900">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          Catégorie
        </span>
        <select
          name="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="mt-2 h-9 rounded-md border border-border bg-slate-50 px-3 text-sm"
        >
          <option value="">Toutes les catégories</option>
          {categoryOptions.map((item) => (
            <option key={item.id} value={item.label}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-900">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          Groupe
        </span>
        <select
          name="groupId"
          value={groupId}
          onChange={(event) => setGroupId(event.target.value)}
          disabled={groupDisabled}
          className="mt-2 h-9 rounded-md border border-border bg-slate-50 px-3 text-sm disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">
            {groupDisabled ? "Aucun groupe disponible" : "Tous les groupes"}
          </option>
          {filteredGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
              {group.isGlobal ? " · Toutes communes" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-900">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          Statut
        </span>
        <select
          name="status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="mt-2 h-9 rounded-md border border-border bg-slate-50 px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="EN_ATTENTE">En attente</option>
          <option value="ACTIVE">Approuvé</option>
          <option value="ARCHIVED">Archivé</option>
        </select>
      </label>
      <Button type="submit" className="md:col-span-2">
        Filtrer
      </Button>
    </form>
  );
}
