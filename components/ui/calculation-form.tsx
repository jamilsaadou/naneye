"use client";

import { useActionState } from "react";
import { ProgressSubmit } from "@/components/ui/progress-submit";

type ActionState = { ok: boolean; message: string } | null;

type CalculationFormProps = {
  action: (formData: FormData) => Promise<{ ok: boolean; message: string }>;
  buttonLabel: string;
  pendingLabel?: string;
  children?: React.ReactNode;
  variant?: "default" | "outline";
};

export function CalculationForm({
  action,
  buttonLabel,
  pendingLabel,
  children,
  variant = "default",
}: CalculationFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (_prev, formData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      {children}
      <ProgressSubmit label={buttonLabel} pendingLabel={pendingLabel} variant={variant} />
      {state?.message ? (
        <div className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-600"}`}>{state.message}</div>
      ) : null}
    </form>
  );
}
