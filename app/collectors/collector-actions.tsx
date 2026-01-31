"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetCollectorCredentials, setCollectorStatus, updateCollector } from "./actions";

const STATUS_ACTIVE = "ACTIVE";
const STATUS_SUSPENDED = "SUSPENDED";

type CollectorRow = {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED";
};

export function CollectorActions({ collector }: { collector: CollectorRow }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Actions
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Actions collecteur</h3>
                <p className="text-xs text-muted-foreground">{collector.name}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </div>

            <ActionForm action={updateCollector} className="mt-4 space-y-3" successMessage="Collecteur mis à jour.">
              <input type="hidden" name="id" value={collector.id} />
              <Input name="code" defaultValue={collector.code} required />
              <Input name="name" defaultValue={collector.name} required />
              <Input name="phone" defaultValue={collector.phone} required />
              <Input name="email" defaultValue={collector.email ?? ""} required />
              <select
                name="status"
                defaultValue={collector.status}
                className="h-9 w-full rounded-md border border-border bg-white px-3 text-sm"
              >
                <option value={STATUS_ACTIVE}>Actif</option>
                <option value={STATUS_SUSPENDED}>Suspendu</option>
              </select>
              <Button type="submit" className="w-full">
                Sauvegarder
              </Button>
            </ActionForm>

            <div className="mt-4 grid gap-2">
              <ActionForm
                action={setCollectorStatus}
                successMessage={collector.status === STATUS_ACTIVE ? "Collecteur suspendu." : "Collecteur réactivé."}
              >
                <input type="hidden" name="id" value={collector.id} />
                <input
                  type="hidden"
                  name="status"
                  value={collector.status === STATUS_ACTIVE ? STATUS_SUSPENDED : STATUS_ACTIVE}
                />
                <Button type="submit" variant="outline" className="w-full">
                  {collector.status === STATUS_ACTIVE ? "Suspendre" : "Réactiver"}
                </Button>
              </ActionForm>

              <ActionForm action={resetCollectorCredentials} successMessage="Accès réinitialisé. Email envoyé.">
                <input type="hidden" name="id" value={collector.id} />
                <Button type="submit" variant="outline" className="w-full">
                  Réinitialiser l&apos;accès
                </Button>
              </ActionForm>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
