"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import { normalizeUploadUrl } from "@/lib/upload-utils";

export type TaxpayerModalNotice = {
  number: string;
  status: string;
  totalAmount: number | string;
  amountPaid: number | string;
};

export type TaxpayerModalLog = {
  id: string;
  action: string;
  actionLabel?: string;
  actorName: string;
  createdAt: string;
  detailsLabel?: string;
  details?: Array<{ label: string; from?: string; to?: string; value?: string }>;
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

const NOTICE_STATUS_LABELS: Record<string, string> = {
  UNPAID: "Non payé",
  PARTIAL: "Partiel",
  PAID: "Payé",
};

type TabType = "info" | "history" | "photos";

export function TaxpayerDetailsModal({
  taxpayer,
  logs,
}: {
  taxpayer: TaxpayerModalData;
  logs: TaxpayerModalLog[];
}) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("info");
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const latestNotice = taxpayer.latestNotice;
  const statusLabel = latestNotice ? NOTICE_STATUS_LABELS[latestNotice.status] ?? "Non payé" : "Aucun";
  const statusVariant = latestNotice?.status === "PAID" ? "success" : latestNotice?.status === "PARTIAL" ? "warning" : "outline";

  const startedAt = useMemo(() => {
    if (!taxpayer.startedAt) return "-";
    const date = new Date(taxpayer.startedAt);
    return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("fr-FR");
  }, [taxpayer.startedAt]);

  const normalizedPhotoUrls = useMemo(
    () => taxpayer.photoUrls.map((url) => normalizeUploadUrl(url) ?? url),
    [taxpayer.photoUrls]
  );

  const historyCount = taxpayer.paymentHistory.length + taxpayer.reductions.length + logs.length;

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "info", label: "Informations" },
    { key: "history", label: "Historique", count: historyCount },
    { key: "photos", label: "Photos", count: normalizedPhotoUrls.length },
  ];

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
          <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-white/90 via-white/80 to-white/70 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/30 bg-white/60 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-lg font-semibold text-slate-900">{taxpayer.name}</h2>
                  <Badge variant={statusVariant} className="shrink-0">{statusLabel}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
                    {taxpayer.code ?? "-"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{taxpayer.commune}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">{taxpayer.category ?? "-"}</span>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-8 w-8 p-0">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-white/30 bg-white/40 px-5 py-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-slate-900 text-white"
                      : "text-slate-600 hover:bg-white/60"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                      activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === "info" && (
                <div className="space-y-4">
                  {/* Identité */}
                  <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div>
                    <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <div className="text-xs text-slate-400">Quartier</div>
                        <div className="font-medium text-slate-900">{taxpayer.neighborhood}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Téléphone</div>
                        <div className="font-medium text-slate-900">{taxpayer.phone ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Email</div>
                        <div className="font-medium text-slate-900">{taxpayer.email ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Adresse</div>
                        <div className="font-medium text-slate-900">{taxpayer.address ?? "-"}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Début d&apos;activité</div>
                        <div className="font-medium text-slate-900">{startedAt}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">GPS</div>
                        <div className="font-medium text-slate-900">
                          {taxpayer.latitude && taxpayer.longitude
                            ? `${taxpayer.latitude}, ${taxpayer.longitude}`
                            : "-"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Facturation */}
                  <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facturation</div>
                      <div className="text-xs text-slate-500">Avis: {latestNotice?.number ?? "Aucun"}</div>
                    </div>
                    <div className="mt-3 space-y-2">
                      {taxpayer.paymentSummary.length === 0 ? (
                        <div className="text-sm text-slate-500">Aucun avis enregistré.</div>
                      ) : (
                        taxpayer.paymentSummary.slice(0, 3).map((summary) => (
                          <div
                            key={summary.year}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm"
                          >
                            <span className="font-semibold text-slate-900">{summary.year}</span>
                            <span className="text-slate-600">{summary.total.toLocaleString("fr-FR")}</span>
                            <span className="text-slate-600">{summary.paid.toLocaleString("fr-FR")}</span>
                            <span className="font-medium text-emerald-700">{summary.due.toLocaleString("fr-FR")}</span>
                          </div>
                        ))
                      )}
                      {taxpayer.paymentSummary.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setActiveTab("history")}
                          className="text-xs text-emerald-700 hover:underline"
                        >
                          Voir tout ({taxpayer.paymentSummary.length} années)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Commentaire */}
                  {taxpayer.comment && (
                    <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Commentaire</div>
                      <div className="mt-2 text-sm text-slate-700">{taxpayer.comment}</div>
                    </div>
                  )}

                  {/* Groupe */}
                  {taxpayer.groupName && (
                    <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
                      <span className="text-slate-500">Groupe:</span>{" "}
                      <span className="font-medium text-slate-900">{taxpayer.groupName}</span>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div className="space-y-4">
                  {/* Par année fiscale */}
                  {taxpayer.paymentSummary.length > 0 && (
                    <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Par année fiscale</div>
                      <div className="mt-3 space-y-2">
                        {taxpayer.paymentSummary.map((summary) => (
                          <div
                            key={summary.year}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm"
                          >
                            <span className="font-semibold text-slate-900">{summary.year}</span>
                            <div className="flex gap-3 text-xs">
                              <span>Total: {summary.total.toLocaleString("fr-FR")}</span>
                              <span>Payé: {summary.paid.toLocaleString("fr-FR")}</span>
                              <span className="text-emerald-700">Solde: {summary.due.toLocaleString("fr-FR")}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Paiements */}
                  <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Paiements ({taxpayer.paymentHistory.length})
                    </div>
                    <div className="mt-3 space-y-2">
                      {taxpayer.paymentHistory.length === 0 ? (
                        <div className="text-sm text-slate-500">Aucun paiement.</div>
                      ) : (
                        taxpayer.paymentHistory.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 text-sm"
                          >
                            <div>
                              <div className="font-medium text-slate-900">{payment.noticeNumber}</div>
                              <div className="text-xs text-slate-500">{payment.paidAt} · {payment.method}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">
                                {Number(payment.amount).toLocaleString("fr-FR")}
                              </span>
                              {payment.proofUrl && (
                                <a
                                  href={normalizeUploadUrl(payment.proofUrl) ?? payment.proofUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-emerald-700 hover:underline"
                                >
                                  Preuve
                                </a>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Réductions */}
                  <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Réductions ({taxpayer.reductions.length})
                    </div>
                    <div className="mt-3 space-y-2">
                      {taxpayer.reductions.length === 0 ? (
                        <div className="text-sm text-slate-500">Aucune réduction.</div>
                      ) : (
                        taxpayer.reductions.map((reduction) => (
                          <div
                            key={reduction.id}
                            className="rounded-lg bg-white/60 px-3 py-2 text-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900">
                                {reduction.noticeNumber} · {reduction.year}
                              </span>
                              <span className="text-rose-600">
                                -{Number(reduction.amount).toLocaleString("fr-FR")}
                              </span>
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {reduction.createdAt} · {reduction.author}
                              {reduction.reason && ` · ${reduction.reason}`}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Modifications */}
                  <div className="rounded-xl border border-white/40 bg-white/70 p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Modifications ({logs.length})
                    </div>
                    <div className="mt-3 space-y-2">
                      {logs.length === 0 ? (
                        <div className="text-sm text-slate-500">Aucune modification.</div>
                      ) : (
                        logs.map((log) => (
                          <div key={log.id} className="rounded-lg bg-white/60 px-3 py-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-slate-900">{log.actionLabel ?? log.action}</span>
                              <span className="text-xs text-slate-500">{log.createdAt}</span>
                            </div>
                            <div className="text-xs text-slate-500">Par {log.actorName}</div>
                            {log.details && log.details.length > 0 && (
                              <div className="mt-2 space-y-0.5 text-xs text-slate-600">
                                {log.details.map((item) => (
                                  <div key={`${log.id}-${item.label}`}>
                                    <span className="font-medium">{item.label}:</span>{" "}
                                    {item.from !== undefined && item.to !== undefined
                                      ? `${item.from} → ${item.to}`
                                      : item.value}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "photos" && (
                <div className="space-y-4">
                  {normalizedPhotoUrls.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {normalizedPhotoUrls.map((url, index) => (
                        <button
                          type="button"
                          key={`${url}-${index}`}
                          className="group relative overflow-hidden rounded-xl"
                          onClick={() => setActivePhoto(url)}
                          aria-label={`Voir photo ${index + 1}`}
                        >
                          <Image
                            src={url}
                            alt={`Photo ${index + 1}`}
                            width={320}
                            height={200}
                            className="h-44 w-full rounded-xl object-cover transition duration-300 group-hover:scale-105"
                            unoptimized
                          />
                          <div className="absolute inset-0 bg-slate-900/0 transition group-hover:bg-slate-900/20" />
                          <div className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2 py-1 text-xs">
                            Agrandir
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                      Aucune photo disponible
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-white/30 bg-white/50 px-5 py-3">
              <a
                href={`/taxpayers/${taxpayer.id}`}
                className="text-sm text-emerald-700 hover:underline"
              >
                Modifier le contribuable
              </a>
              <a
                href={`/taxpayers/${taxpayer.id}/payments`}
                className="text-sm text-emerald-700 hover:underline"
              >
                Gérer les paiements
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {activePhoto ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 py-6">
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md" onClick={() => setActivePhoto(null)} />
          <div className="relative z-10 w-full max-w-4xl">
            <Image
              src={activePhoto}
              alt={`Photo de ${taxpayer.name}`}
              width={1200}
              height={800}
              className="max-h-[85vh] w-full rounded-2xl object-contain shadow-2xl"
              unoptimized
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
