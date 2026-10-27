"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RunStatus } from "@/lib/runner";
import { timeAgo } from "@/lib/format";

const call = async (method: "GET" | "POST" | "DELETE"): Promise<RunStatus> => {
  const res = await fetch("/api/get-jobs", { method, headers: { "x-link-agent": "1" }, cache: "no-store" });
  return res.json();
};

export function GetJobsButton({ initial }: { initial: RunStatus }) {
  const router = useRouter();
  const [status, setStatus] = useState<RunStatus>(initial);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(initial.state === "running");

  const refresh = useCallback(async () => {
    const next = await call("GET");
    setStatus(next);
    // A run just finished: reload the list so new openings appear.
    if (wasRunning.current && next.state !== "running") router.refresh();
    wasRunning.current = next.state === "running";
  }, [router]);

  useEffect(() => {
    if (status.state !== "running") return;
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [status.state, refresh]);

  const start = async () => {
    setBusy(true);
    try {
      const next = await call("POST");
      setStatus(next);
      wasRunning.current = next.state === "running";
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setStatus(await call("DELETE"));
    } finally {
      setBusy(false);
    }
  };

  const running = status.state === "running";
  const pct = running && status.pagesTotal ? Math.min(100, ((status.pagesDone ?? 0) / status.pagesTotal) * 100) : 0;

  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:items-end">
      <div className="flex gap-2">
        {running ? (
          <>
            <span className="btn-primary pointer-events-none gap-2.5">
              <span className="size-3.5 animate-spin rounded-full border-2 border-on-inverse/30 border-t-on-inverse" />
              Getting jobs…
            </span>
            <button onClick={stop} disabled={busy} className="btn-secondary">
              Stop
            </button>
          </>
        ) : (
          <button onClick={start} disabled={busy} className="btn-primary">
            {busy ? "Starting…" : "Get jobs"}
          </button>
        )}
      </div>

      {running && (
        <div className="w-full sm:w-72">
          <div className="h-1 overflow-hidden rounded-full bg-surface-strong">
            <div className="h-full rounded-full bg-inverse transition-all duration-700" style={{ width: `${Math.max(pct, 4)}%` }} />
          </div>
          <p className="mt-1.5 text-caption text-fg-2 sm:text-right">
            {status.message}
            {status.searched?.length ? ` · now: ${status.searched.at(-1)}` : ""}
          </p>
        </div>
      )}

      {status.state === "done" && (
        <div className="text-caption sm:text-right">
          <p className="text-positive">
            {status.newJobs ? `${status.newJobs} new opening${status.newJobs === 1 ? "" : "s"}` : "No new openings this time"}
            {status.byCity?.length ? `: ${status.byCity.map(([c, n]) => `${c} ${n}`).join(", ")}` : ""} · {timeAgo(status.finishedAt)}
          </p>
          {status.searched?.length ? (
            <details className="mt-1 text-fg-2">
              <summary className="cursor-pointer">Searched {status.searched.length} pages</summary>
              <ul className="mt-1 space-y-0.5">
                {status.searched.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      )}

      {status.state === "failed" && status.message && (
        <p className="max-w-sm text-caption text-negative sm:text-right" title={status.message}>
          {status.message.length > 160 ? `${status.message.slice(0, 160)}…` : status.message}
        </p>
      )}
    </div>
  );
}
