"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionForm } from "@/components/ui/action-form";
import { createManualPaymentFromLookup, lookupPaymentInfo } from "./actions";

const METHODS = [
  { value: "TRANSFER", label: "Virement" },
  { value: "CHEQUE", label: "Cheque" },
] as const;

function formatNumber(value: number) {
  const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
  return formatted.replace(/[\s\u202f\u00a0]/g, ".");
}

function formatMoney(value: number) {
  return `${formatNumber(value)} FCFA`;
}

type LookupPayload = {
  taxpayer: { id: string; name: string; code: string | null; commune: string };
  notice: { id: string; number: string; year: number; totalAmount: number; amountPaid: number };
};

export function PaymentFlow({ defaultCode = "", defaultNotice = "" }: { defaultCode?: string; defaultNotice?: string }) {
  const [step, setStep] = useState<"lookup" | "pay">("lookup");
  const [payload, setPayload] = useState<LookupPayload | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("TRANSFER");

  const remaining = payload
    ? Math.max(0, payload.notice.totalAmount - payload.notice.amountPaid)
    : 0;
  const amountValue = Number(amount.replace(",", "."));
  const remainingAfter = payload
    ? Math.max(0, remaining - (Number.isFinite(amountValue) ? amountValue : 0))
    : 0;

  const [lookupState, lookupAction] = useMemo(() => {
    return [null, async (formData: FormData) => {
      const response = await lookupPaymentInfo(formData);
      if (!response || !response.ok || !response.payload) {
        throw new Error("Recherche echouee");
      }
      setPayload(response.payload as LookupPayload);
      setStep("pay");
      return { ok: true, message: "Contribuable charge." };
    }];
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-xl border ${step === "lookup" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"} p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M21 21l-4.3-4.3" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Identifiants</div>
              <div className="text-xs text-slate-600">Code contribuable + numero d&apos;avis</div>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border ${step === "pay" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"} p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16v4H4z" />
                <path d="M4 10h16v10H4z" />
                <path d="M8 14h4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Verification</div>
              <div className="text-xs text-slate-600">Infos contribuable + solde</div>
            </div>
          </div>
        </div>
        <div className={`rounded-xl border ${step === "pay" ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"} p-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <path d="M2 10h20" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-900">Encaissement</div>
              <div className="text-xs text-slate-600">Montant + confirmation</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="text-sm font-semibold text-slate-900">Recherche</div>
        <ActionForm action={lookupAction as any} className="mt-3 grid gap-3 md:grid-cols-3" successMessage="Contribuable charge.">
          <label className="text-sm font-medium text-slate-900">
            Code contribuable
            <Input name="taxpayerCode" defaultValue={defaultCode} required className="mt-2" />
          </label>
          <label className="text-sm font-medium text-slate-900">
            Numero d&apos;avis
            <Input name="noticeNumber" defaultValue={defaultNotice} required className="mt-2" />
          </label>
          <div className="flex items-end">
            <Button type="submit" className="w-full">Rechercher</Button>
          </div>
        </ActionForm>
      </div>

      {payload ? (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5">
            <div className="text-sm font-semibold text-slate-900">Contribuable</div>
            <div className="mt-2 text-lg font-semibold text-slate-900">{payload.taxpayer.name}</div>
            <div className="mt-1 text-xs text-slate-600">
              {payload.taxpayer.code ?? "-"} · {payload.taxpayer.commune}
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Montant total</span>
                <strong>{formatMoney(payload.notice.totalAmount)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Montant deja paye</span>
                <strong>{formatMoney(payload.notice.amountPaid)}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span>Reste a payer</span>
                <strong>{formatMoney(remaining)}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Encaisser</div>
            <ActionForm
              action={createManualPaymentFromLookup}
              className="mt-3 grid gap-3"
              successMessage="Paiement enregistre."
            >
              <input type="hidden" name="taxpayerId" value={payload.taxpayer.id} />
              <input type="hidden" name="noticeId" value={payload.notice.id} />
              <label className="text-sm font-medium text-slate-900">
                Montant a encaisser
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="mt-2"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium text-slate-900">
                Mode de paiement
                <select
                  name="method"
                  required
                  className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={method}
                  onChange={(event) => setMethod(event.target.value as (typeof METHODS)[number]["value"])}
                >
                  {METHODS.map((method) => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </label>
              {method === "TRANSFER" || method === "CHEQUE" ? (
                <label className="text-sm font-medium text-slate-900">
                  Preuve de paiement (photo)
                  <Input name="proofFile" type="file" accept="image/*" required className="mt-2" />
                  <div className="mt-1 text-xs text-slate-500">Photo du cheque ou preuve de virement.</div>
                </label>
              ) : null}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Reste apres transaction: <strong>{formatMoney(remainingAfter)}</strong>
              </div>
              <div className="flex justify-end">
                <Button type="submit">Confirmer le paiement</Button>
              </div>
            </ActionForm>
          </div>
        </div>
      ) : null}
    </div>
  );
}
