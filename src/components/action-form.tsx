"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/types";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.message ? <p className={state.ok ? "form-ok" : "form-err"}>{state.message}</p> : null}
      {pending ? <p className="form-pending">正在保存…</p> : null}
    </form>
  );
}
