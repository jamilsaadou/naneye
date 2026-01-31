"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

function buildMapUrl(lat: number, lon: number) {
  const delta = 0.01;
  const left = lon - delta;
  const right = lon + delta;
  const top = lat + delta;
  const bottom = lat - delta;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left},${bottom},${right},${top}&layer=mapnik&marker=${lat},${lon}`;
}

function buildOpenUrl(lat: number, lon: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=18/${lat}/${lon}`;
}

export function OsmLocation({ initialLat, initialLon }: { initialLat?: string | null; initialLon?: string | null }) {
  const [lat, setLat] = useState(initialLat ?? "");
  const [lon, setLon] = useState(initialLon ?? "");

  const coords = useMemo(() => {
    const parsedLat = Number.parseFloat(lat);
    const parsedLon = Number.parseFloat(lon);
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) return null;
    return { lat: parsedLat, lon: parsedLon };
  }, [lat, lon]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900">Coordonnées GPS</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!coords}
          onClick={() => {
            if (!coords) return;
            window.open(buildOpenUrl(coords.lat, coords.lon), "_blank", "noopener,noreferrer");
          }}
        >
          Ouvrir la carte
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-900">
          Latitude
          <input
            name="latitude"
            type="number"
            step="0.000001"
            value={lat}
            onChange={(event) => setLat(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
          />
        </label>
        <label className="text-sm font-medium text-slate-900">
          Longitude
          <input
            name="longitude"
            type="number"
            step="0.000001"
            value={lon}
            onChange={(event) => setLon(event.target.value)}
            className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
          />
        </label>
      </div>
      <div className="rounded-2xl border border-white/40 bg-white/80 p-3">
        {coords ? (
          <iframe
            title="Carte OSM"
            src={buildMapUrl(coords.lat, coords.lon)}
            className="h-56 w-full rounded-xl border border-border"
          />
        ) : (
          <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
            Renseignez les coordonnées pour afficher la carte.
          </div>
        )}
      </div>
    </div>
  );
}
