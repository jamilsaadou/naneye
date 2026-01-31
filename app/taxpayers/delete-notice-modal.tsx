"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ProgressSubmit } from "@/components/ui/progress-submit";
import { deleteNoticeByYear } from "./actions";

type ActionState = { ok: boolean; message: string } | null;

export function DeleteNoticeModal({
  taxpayerId,
  years,
}: {
  taxpayerId: string;
  years: number[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      try {
        await deleteNoticeByYear(formData);
        return { ok: true, message: "Facture fiscale supprimée." };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Suppression échouée.";
        return { ok: false, message };
      }
    },
    null,
  );

  const disabled = years.length === 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 w-8 p-0"
        title={disabled ? "Aucune facture fiscale" : "Supprimer une facture fiscale"}
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 14h10l1-14" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/30 bg-white/90 p-5 shadow-2xl">
            <div className="text-sm font-semibold text-slate-900">Supprimer une facture fiscale</div>
            <p className="mt-2 text-sm text-slate-600">
              Choisissez l&apos;année de l&apos;avis à supprimer. Cette action est irréversible.
            </p>

            <form action={formAction} className="mt-4 space-y-3">
              <input type="hidden" name="taxpayerId" value={taxpayerId} />
              <label className="text-sm font-medium text-slate-900">
                Année fiscale
                <select
                  name="year"
                  required
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                >
                  <option value="">Choisir l&apos;année</option>
                  {years.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              {state?.message ? (
                <div className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-600"}`}>
                  {state.message}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <ProgressSubmit label="Confirmer" pendingLabel="Suppression..." variant="default" />
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
