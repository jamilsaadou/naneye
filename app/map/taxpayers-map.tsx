"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type MapTaxpayer = {
  id: string;
  name: string;
  code: string | null;
  commune: string;
  neighborhood: string;
  latitude: string;
  longitude: string;
  paymentStatus: "PAID" | "PARTIAL" | "UNPAID";
};

export function TaxpayersMap({ taxpayers }: { taxpayers: MapTaxpayer[] }) {
  const [activeId, setActiveId] = useState(taxpayers[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [commune, setCommune] = useState("");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any>(null);
  const markersByIdRef = useRef(new Map<string, any>());
  const leafletRef = useRef<any>(null);

  const communes = useMemo(() => {
    const values = Array.from(new Set(taxpayers.map((item) => item.commune))).filter(Boolean);
    return values.sort((a, b) => a.localeCompare(b, "fr-FR"));
  }, [taxpayers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return taxpayers.filter((item) => {
      if (commune && item.commune !== commune) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.code ?? "").toLowerCase().includes(q) ||
        item.neighborhood.toLowerCase().includes(q)
      );
    });
  }, [taxpayers, query, commune]);

  const active = filtered.find((item) => item.id === activeId) ?? filtered[0];

  useEffect(() => {
    if (activeId && filtered.some((item) => item.id === activeId)) return;
    setActiveId(filtered[0]?.id ?? "");
  }, [activeId, filtered]);

  const validCoords = useMemo(
    () =>
      filtered
        .map((item) => {
          const lat = Number.parseFloat(item.latitude);
          const lon = Number.parseFloat(item.longitude);
          if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
          return { ...item, lat, lon };
        })
        .filter((item) => item !== null),
    [filtered],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    let cancelled = false;
    const loadLeaflet = async () => {
      if (typeof window === "undefined") return null;
      if ((window as any).L) return (window as any).L;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      return new Promise<any>((resolve) => {
        const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve((window as any).L));
          if ((window as any).L) resolve((window as any).L);
          return;
        }

        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.async = true;
        script.onload = () => resolve((window as any).L);
        document.body.appendChild(script);
      });
    };

    loadLeaflet().then((L) => {
      if (cancelled || !mapContainerRef.current || !L) return;
      leafletRef.current = L;
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(mapRef.current);
      markersRef.current = L.layerGroup().addTo(mapRef.current);
      mapRef.current.setView([17.6078, 8.0817], 5);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    const layer = markersRef.current;
    if (!map || !L || !layer) return;

    layer.clearLayers();
    markersByIdRef.current.clear();

    const bounds: [number, number][] = [];
    validCoords.forEach((item) => {
      const statusClass =
        item.paymentStatus === "PAID"
          ? "taxpayer-marker--paid"
          : item.paymentStatus === "PARTIAL"
            ? "taxpayer-marker--partial"
            : "taxpayer-marker--unpaid";
      const icon = L.divIcon({
        className: "taxpayer-marker-wrapper",
        html: `<div class="taxpayer-marker ${statusClass}"><span class="taxpayer-marker__pin"></span><span class="taxpayer-marker__dot"></span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 26],
        popupAnchor: [0, -24],
      });
      const marker = L.marker([item.lat, item.lon], { icon });
      const popup = document.createElement("div");
      popup.className = "taxpayer-popup";
      const name = document.createElement("div");
      name.className = "taxpayer-popup__title";
      name.textContent = item.name;
      const meta = document.createElement("div");
      meta.className = "taxpayer-popup__meta";
      const statusLabel =
        item.paymentStatus === "PAID" ? "Payé" : item.paymentStatus === "PARTIAL" ? "Partiel" : "Non payé";
      meta.textContent = `${item.code ?? "-"} · ${item.commune} · ${item.neighborhood} · ${statusLabel}`;
      const link = document.createElement("a");
      link.className = "taxpayer-popup__link";
      link.href = `/taxpayers/${item.id}`;
      link.textContent = "Voir les details";
      popup.append(name, meta, link);

      marker.bindPopup(popup, { closeButton: true });
      marker.on("click", () => setActiveId(item.id));
      marker.addTo(layer);
      markersByIdRef.current.set(item.id, marker);
      bounds.push([item.lat, item.lon]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([17.6078, 8.0817], 5);
    }
  }, [validCoords]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markersByIdRef.current.get(activeId);
    if (!map || !marker) return;
    marker.openPopup();
    map.setView(marker.getLatLng(), Math.max(map.getZoom(), 15), { animate: true });
  }, [activeId]);

  if (taxpayers.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white/80 p-6 text-sm text-muted-foreground">
        Aucun contribuable avec coordonnées GPS.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-white/80 p-4 shadow-sm md:flex-row md:items-center">
        <div className="text-sm font-semibold text-slate-900">Filtres</div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher (nom, code, quartier)"
          className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm md:max-w-sm"
        />
        <select
          value={commune}
          onChange={(event) => setCommune(event.target.value)}
          className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm md:max-w-xs"
        >
          <option value="">Toutes les communes</option>
          {communes.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        {filtered.length === 0 && (
          <div className="text-xs text-muted-foreground">Aucun contribuable trouvé.</div>
        )}
      </div>
      <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Carte OSM</div>
        <div className="relative mt-3">
          <div ref={mapContainerRef} className="h-[640px] w-full rounded-2xl border border-border" />
          {validCoords.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 text-sm text-slate-500">
              Aucun contribuable avec coordonnées valides pour ce filtre.
            </div>
          )}
        </div>
      </div>
      <style jsx global>{`
        .taxpayer-marker-wrapper {
          background: transparent;
          border: none;
        }
        .taxpayer-marker {
          position: relative;
          width: 28px;
          height: 28px;
        }
        .taxpayer-marker--paid .taxpayer-marker__pin {
          background: linear-gradient(135deg, #16a34a, #22c55e);
          box-shadow: 0 6px 12px rgba(15, 118, 110, 0.35);
        }
        .taxpayer-marker--partial .taxpayer-marker__pin {
          background: linear-gradient(135deg, #f59e0b, #facc15);
          box-shadow: 0 6px 12px rgba(202, 138, 4, 0.35);
        }
        .taxpayer-marker--unpaid .taxpayer-marker__pin {
          background: linear-gradient(135deg, #ef4444, #f97316);
          box-shadow: 0 6px 12px rgba(220, 38, 38, 0.35);
        }
        .taxpayer-marker__pin {
          position: absolute;
          left: 50%;
          top: 2px;
          width: 18px;
          height: 18px;
          transform: translateX(-50%) rotate(45deg);
          border-radius: 50% 50% 50% 0;
          border: 2px solid #ecfdf3;
        }
        .taxpayer-marker__dot {
          position: absolute;
          left: 50%;
          top: 8px;
          width: 8px;
          height: 8px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: #f8fafc;
          box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.2);
        }
        .taxpayer-popup {
          display: grid;
          gap: 6px;
          min-width: 200px;
        }
        .taxpayer-popup__title {
          font-weight: 600;
          color: #0f172a;
        }
        .taxpayer-popup__meta {
          font-size: 12px;
          color: #64748b;
        }
        .taxpayer-popup__link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          background: #0f172a;
          color: #f8fafc;
          text-decoration: none;
        }
      `}</style>
    </div>
  );
}
