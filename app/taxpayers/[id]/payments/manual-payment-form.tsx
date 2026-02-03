"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createManualPayment } from "./actions";

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

type NoticeOption = {
  id: string;
  number: string;
  year: number;
  totalAmount: number;
  amountPaid: number;
};

export function ManualPaymentForm({ taxpayerId, notices }: { taxpayerId: string; notices: NoticeOption[] }) {
  const [noticeId, setNoticeId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("TRANSFER");

  const notice = useMemo(() => notices.find((item) => item.id === noticeId) ?? null, [noticeId, notices]);
  const amountValue = Number(amount.replace(",", "."));
  const remaining = notice ? Math.max(0, notice.totalAmount - notice.amountPaid) : 0;
  const remainingAfter = notice
    ? Math.max(0, remaining - (Number.isFinite(amountValue) ? amountValue : 0))
    : 0;

  return (
    <ActionForm
      action={createManualPayment}
      className="grid gap-3 md:grid-cols-3"
      successMessage="Paiement enregistre."
    >
      <input type="hidden" name="taxpayerId" value={taxpayerId} />
      <label className="text-sm font-medium text-slate-900">
        Avis
        <select
          name="noticeId"
          required
          className="mt-2 h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
          value={noticeId}
          onChange={(event) => setNoticeId(event.target.value)}
        >
          <option value="">Choisir l&apos;avis</option>
          {notices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.number} ({item.year})
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-900">
        Montant
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
      <div className="md:col-span-3 grid gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Montant total</span>
          <strong>{formatMoney(notice?.totalAmount ?? 0)}</strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Montant deja paye</span>
          <strong>{formatMoney(notice?.amountPaid ?? 0)}</strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Reste a payer avant</span>
          <strong>{formatMoney(remaining)}</strong>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>Reste a payer apres</span>
          <strong>{formatMoney(remainingAfter)}</strong>
        </div>
      </div>
      <div className="md:col-span-3 flex justify-end">
        <Button type="submit">Encaisser</Button>
      </div>
    </ActionForm>
  );
}
