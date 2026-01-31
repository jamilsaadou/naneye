"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type ProgressSubmitProps = {
  label: string;
  pendingLabel?: string;
  variant?: "default" | "outline";
};

export function ProgressSubmit({ label, pendingLabel, variant = "default" }: ProgressSubmitProps) {
  const { pending } = useFormStatus();
  return (
    <div className="space-y-3">
      <Button type="submit" variant={variant} disabled={pending}>
        {pending ? pendingLabel ?? label : label}
      </Button>
      <div className={pending ? "progress-bar" : "hidden"}>
        <div className="progress-bar__fill" />
      </div>
    </div>
  );
}
