"use client";

import { useActionState } from "react";
import { CsrfTokenField } from "@/components/ui/csrf-token-field";

type ActionState = { ok: boolean; message: string } | null;

type ActionFormProps = {
  action: (formData: FormData) => Promise<unknown>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
  showMessage?: boolean;
};

export function ActionForm({
  action,
  children,
  className,
  successMessage = "Enregistrement effectue.",
  showMessage = true,
}: ActionFormProps) {
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (_prev, formData) => {
      try {
        const result = (await action(formData)) as { ok?: boolean; message?: string } | undefined;
        if (result && typeof result.ok === "boolean" && result.message) {
          return { ok: result.ok, message: result.message };
        }
        return { ok: true, message: successMessage };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Une erreur est survenue.";
        return { ok: false, message };
      }
    },
    null,
  );

  return (
    <form
      action={formAction}
      className={className}
    >
      <CsrfTokenField />
      {children}
      {showMessage && state?.message ? (
        <div className={`text-sm ${state.ok ? "text-emerald-600" : "text-rose-600"}`}>{state.message}</div>
      ) : null}
    </form>
  );
}
