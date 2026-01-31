"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { approveReductionRequest, rejectReductionRequest } from "../actions";

type ReductionApprovalActionsProps = {
  reductionId: string;
  taxpayerName: string;
  taxpayerCode: string;
  noticeNumber: string;
  amountLabel: string;
  createdBy: string;
  reason: string;
};

export function ReductionApprovalActions({
  reductionId,
  taxpayerName,
  taxpayerCode,
  noticeNumber,
  amountLabel,
  createdBy,
  reason,
}: ReductionApprovalActionsProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-primary"
      >
        Detail
      </button>
      {open && mounted
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-slate-900/40 p-2 pt-0"
              onClick={() => setOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
              }}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
            >
              <div
                className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl max-h-[85vh] overflow-auto"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-900">Detail de la demande</h3>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    Fermer
                  </button>
                </div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <div className="font-semibold text-slate-900">{taxpayerName}</div>
                    <div>Code: {taxpayerCode}</div>
                    <div>Avis: {noticeNumber}</div>
                    <div>Montant: {amountLabel}</div>
                    <div>Demandeur: {createdBy}</div>
                    <div>Motif: {reason || "-"}</div>
                  </div>
                  <ActionForm action={approveReductionRequest} className="grid gap-2">
                    <input type="hidden" name="id" value={reductionId} />
                    <input
                      type="text"
                      name="reviewNote"
                      placeholder="Note (optionnel)"
                      className="h-9 rounded-md border border-border px-2 text-xs"
                    />
                    <Button type="submit" size="sm">Approuver</Button>
                  </ActionForm>
                  <ActionForm action={rejectReductionRequest} className="grid gap-2">
                    <input type="hidden" name="id" value={reductionId} />
                    <input
                      type="text"
                      name="reviewNote"
                      placeholder="Motif du rejet"
                      className="h-9 rounded-md border border-border px-2 text-xs"
                    />
                    <Button type="submit" size="sm" variant="outline">Rejeter</Button>
                  </ActionForm>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
