"use client";

import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const QUICK = [
  { label: "Simplify", ask: "Simplify it: plainer words and shorter sentences. Keep every fact, gap and the sign-off." },
  { label: "Elaborate", ask: "Elaborate: add one or two more achievements from my resume that match this job, still under 250 words before the sign-off." },
  { label: "Shorter", ask: "Make it shorter: under 120 words before the sign-off, keeping the strongest match to this job." },
  { label: "More formal", ask: "Make the tone more formal and polished." },
  { label: "Friendlier", ask: "Make the tone warmer and more conversational, still professional." },
  { label: "Match the post", ask: "Make it match this job post more closely: lead with what the post asks for most and use its terms where my resume supports them." },
];

/**
 * Chat with Claude about the email on this job page. It knows your resume,
 * the job post and the current email; each answer can rewrite the email.
 */
export function EmailAssistant({
  jobId,
  subject,
  body,
  onRewrite,
}: {
  jobId: number;
  subject: string;
  body: string;
  onRewrite: (next: { subject: string; body: string }) => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ subject: string; body: string } | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, busy]);

  const ask = async (instruction: string, shown = instruction) => {
    if (busy || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    setTurns((t) => [...t, { role: "user", content: shown }]);
    setInput("");
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json", "x-link-agent": "1" },
        body: JSON.stringify({ jobId, subject, body, instruction, history: turns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      const changed = data.subject !== subject || data.body !== body;
      if (changed) {
        setUndo({ subject, body });
        onRewrite({ subject: data.subject, body: data.body });
      }
      setTurns((t) => [...t, { role: "assistant", content: changed ? data.reply : `${data.reply} (Email unchanged.)` }]);
    } catch (e) {
      setError((e as Error).message);
      setTurns((t) => t.slice(0, -1));
      setInput(shown === instruction ? instruction : "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-[20px] bg-bg p-4 shadow-[0_0_0_1px_var(--line)]">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-compact font-semibold">Email assistant</h3>
        {undo && !busy && (
          <button
            type="button"
            onClick={() => {
              onRewrite(undo);
              setUndo(null);
              setTurns((t) => [...t, { role: "assistant", content: "Restored the previous version." }]);
            }}
            className="text-caption font-semibold text-fg-2 underline underline-offset-2 hover:text-fg"
          >
            Undo last change
          </button>
        )}
      </div>
      <p className="mt-0.5 text-caption text-fg-2">Knows your resume, this post and the email above.</p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={busy}
            onClick={() => ask(q.ask, q.label)}
            className="h-7 rounded-full bg-surface px-3 text-caption font-semibold transition hover:bg-surface-hover disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      {(turns.length > 0 || busy) && (
        <div ref={logRef} className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {turns.map((t, i) => (
            <div
              key={i}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-caption leading-5 ${
                t.role === "user" ? "ml-auto bg-inverse text-on-inverse" : "bg-surface text-fg"
              }`}
            >
              {t.content}
            </div>
          ))}
          {busy && (
            <div className="inline-flex items-center gap-2 rounded-2xl bg-surface px-3 py-2 text-caption text-fg-2">
              <span className="size-3 animate-spin rounded-full border-2 border-fg-3/30 border-t-fg-2" />
              Rewriting…
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-caption text-negative">{error}</p>}

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          disabled={busy}
          placeholder="e.g. mention my YOLO edge work first"
          className="field h-9 py-0"
        />
        <button type="button" onClick={() => ask(input)} disabled={busy || !input.trim()} className="btn-primary h-9 shrink-0 px-4">
          Ask
        </button>
      </div>
    </div>
  );
}
