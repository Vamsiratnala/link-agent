"use client";

import { useActionState } from "react";
import { testEmailAction, type ActionState } from "@/app/actions";

export function TestEmailButton() {
  const [state, action, pending] = useActionState<ActionState>(testEmailAction, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button className="btn-secondary h-8 bg-bg px-4" disabled={pending}>{pending ? "Sending…" : "Send test email"}</button>
      {state && <span className={`text-compact ${state.ok ? "text-positive" : "text-negative"}`}>{state.message}</span>}
    </form>
  );
}
