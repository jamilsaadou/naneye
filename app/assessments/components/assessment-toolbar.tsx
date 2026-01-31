"use client";

import { useState } from "react";

export function AssessmentToolbar({ pdfHref }: { pdfHref: string }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await fetch(pdfHref);
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Erreur lors du téléchargement du PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+?)"/);
      link.href = url;
      link.download = match?.[1] ?? "avis.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur lors du téléchargement du PDF.";
      window.alert(message);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="print:hidden p-4">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="text-sm font-medium text-slate-700">Avis d&apos;imposition</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isDownloading ? "Téléchargement..." : "Télécharger PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
