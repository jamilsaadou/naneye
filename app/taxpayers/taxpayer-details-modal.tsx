"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export type TaxpayerModalNotice = {
  number: string;
  status: string;
  totalAmount: number | string;
  amountPaid: number | string;
};

export type TaxpayerModalLog = {
  id: string;
  action: string;
  actorName: string;
  createdAt: string;
};

export type TaxpayerModalData = {
  id: string;
  code: string | null;
  name: string;
  category: string | null;
  groupName?: string | null;
  commune: string;
  neighborhood: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  photoUrls: string[];
  comment: string | null;
  latitude: string | null;
  longitude: string | null;
  startedAt: string | null;
  latestNotice: TaxpayerModalNotice | null;
  paymentSummary: Array<{
    year: number;
    total: number;
    paid: number;
    due: number;
  }>;
  paymentHistory: Array<{
    id: string;
    paidAt: string;
    amount: number;
    method: string;
    noticeNumber: string;
    proofUrl: string | null;
  }>;
  reductions: Array<{
    id: string;
    noticeNumber: string;
    year: number;
    amount: number;
    previousTotal: number;
    newTotal: number;
    reason: string | null;
    createdAt: string;
    author: string;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  UNPAID: "Non payé",
  PARTIAL: "Partiel",
  PAID: "Payé",
};

export function TaxpayerDetailsModal({
  taxpayer,
  logs,
}: {
  taxpayer: TaxpayerModalData;
  logs: TaxpayerModalLog[];
}) {
  const [open, setOpen] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const latestNotice = taxpayer.latestNotice;
  const statusLabel = latestNotice ? STATUS_LABELS[latestNotice.status] ?? "Non payé" : "Aucun";
  const statusVariant = latestNotice?.status === "PAID" ? "success" : latestNotice?.status === "PARTIAL" ? "warning" : "outline";

  const startedAt = useMemo(() => {
    if (!taxpayer.startedAt) return "-";
    const date = new Date(taxpayer.startedAt);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("fr-FR");
  }, [taxpayer.startedAt]);

  return (
    <>
      <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="Voir détails" onClick={() => setOpen(true)}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-md" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-br from-white/85 via-white/70 to-white/60 shadow-[0_30px_80px_rgba(15,23,42,0.35)] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/30 bg-white/60 px-6 py-5">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-emerald-700">Dossier contribuable</div>
                <h2 className="text-2xl font-semibold text-slate-900">{taxpayer.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">
                    Code {taxpayer.code ?? "-"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{taxpayer.commune}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    {taxpayer.category ?? "-"}
                  </span>
                  {taxpayer.groupName ? (
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">{taxpayer.groupName}</span>
                  ) : null}
                </div>
              </div>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </div>

            <div className="grid gap-6 p-6 md:grid-cols-[1.15fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-white/40 bg-white/75 p-4">
                  <div className="text-sm font-semibold text-slate-900">Identité & contact</div>
                  <div className="mt-4 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase text-slate-400">Quartier</div>
                      <div className="font-medium text-slate-900">{taxpayer.neighborhood}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Téléphone</div>
                      <div className="font-medium text-slate-900">{taxpayer.phone ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Email</div>
                      <div className="font-medium text-slate-900">{taxpayer.email ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Adresse</div>
                      <div className="font-medium text-slate-900">{taxpayer.address ?? "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">Début d&apos;activité</div>
                      <div className="font-medium text-slate-900">{startedAt}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase text-slate-400">GPS</div>
                      <div className="font-medium text-slate-900">
                        {taxpayer.latitude ?? "-"} / {taxpayer.longitude ?? "-"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white/75 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Facturation</div>
                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                  </div>
                  <div className="mt-3 text-sm text-slate-700">Dernier avis: {latestNotice?.number ?? "Aucun"}</div>
                  <div className="mt-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Par année fiscale</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {taxpayer.paymentSummary.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Aucun avis enregistré.</div>
                      ) : (
                        taxpayer.paymentSummary.map((summary) => (
                          <div
                            key={summary.year}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2"
                          >
                            <div className="font-semibold text-slate-900">{summary.year}</div>
                            <div>Total: {summary.total.toLocaleString("fr-FR")}</div>
                            <div>Payé: {summary.paid.toLocaleString("fr-FR")}</div>
                            <div className="text-emerald-700">Solde: {summary.due.toLocaleString("fr-FR")}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Historique des paiements</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {taxpayer.paymentHistory.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Aucun paiement enregistré.</div>
                      ) : (
                        taxpayer.paymentHistory.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2"
                          >
                            <div>
                              <div className="font-medium text-slate-900">{payment.noticeNumber}</div>
                              <div className="text-xs text-slate-500">{payment.paidAt}</div>
                            </div>
                            <div className="text-xs text-slate-600">{payment.method}</div>
                            <div className="font-semibold text-slate-900">
                              {Number(payment.amount).toLocaleString("fr-FR")}
                            </div>
                            {payment.proofUrl ? (
                              <a
                                href={payment.proofUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-emerald-700 hover:underline"
                              >
                                Preuve
                              </a>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Reductions appliquees</div>
                    <div className="mt-3 space-y-2 text-sm text-slate-700">
                      {taxpayer.reductions.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Aucune reduction enregistree.</div>
                      ) : (
                        taxpayer.reductions.map((reduction) => (
                          <div
                            key={reduction.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2"
                          >
                            <div>
                              <div className="font-medium text-slate-900">
                                {reduction.noticeNumber} · {reduction.year}
                              </div>
                              <div className="text-xs text-slate-500">
                                {reduction.createdAt} · {reduction.author}
                              </div>
                              {reduction.reason ? (
                                <div className="text-xs text-slate-500">{reduction.reason}</div>
                              ) : null}
                            </div>
                            <div className="text-xs text-slate-600">
                              -{Number(reduction.amount).toLocaleString("fr-FR")} FCFA
                            </div>
                            <div className="text-xs text-slate-600">
                              {Number(reduction.previousTotal).toLocaleString("fr-FR")} →{" "}
                              {Number(reduction.newTotal).toLocaleString("fr-FR")}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white/75 p-4">
                  <div className="text-sm font-semibold text-slate-900">Historique</div>
                  <div className="mt-3 space-y-2 text-sm text-slate-700">
                    {logs.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Aucune modification enregistrée.</div>
                    ) : (
                      logs.map((log) => (
                        <div
                          key={log.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2"
                        >
                          <div>
                            <div className="font-medium text-slate-900">{log.action}</div>
                            <div className="text-xs text-slate-500">{log.actorName}</div>
                          </div>
                          <div className="text-xs text-slate-500">{log.createdAt}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-white/40 bg-white/75 p-4">
                  <div className="text-sm font-semibold text-slate-900">Photos</div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {taxpayer.photoUrls.length > 0 ? (
                      taxpayer.photoUrls.map((url, index) => (
                        <button
                          type="button"
                          key={`${url}-${index}`}
                          className="group relative overflow-hidden rounded-2xl"
                          onClick={() => setActivePhoto(url)}
                          aria-label={`Voir photo ${index + 1}`}
                        >
                          <img
                            src={url}
                            alt={`Photo ${index + 1} de ${taxpayer.name}`}
                            className="h-40 w-full rounded-2xl object-cover shadow-sm transition duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-slate-900/0 transition duration-300 group-hover:bg-slate-900/20" />
                          <div className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs text-slate-700">
                            Zoom
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                        Aucune photo
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/40 bg-white/75 p-4">
                  <div className="text-sm font-semibold text-slate-900">Commentaire</div>
                  <div className="mt-3 text-sm text-slate-700">
                    {taxpayer.comment ?? "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {activePhoto ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setActivePhoto(null)} />
          <div className="relative z-10 w-full max-w-5xl">
            <img
              src={activePhoto}
              alt={`Photo de ${taxpayer.name}`}
              className="max-h-[85vh] w-full rounded-3xl object-contain shadow-2xl"
            />
            <Button
              type="button"
              variant="outline"
              className="absolute right-3 top-3 bg-white/90"
              onClick={() => setActivePhoto(null)}
            >
              Fermer
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
