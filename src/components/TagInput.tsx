"use client";

import { useState } from "react";
import { XIcon } from "./icons";

/** Chips you add with Enter or a comma; submitted as a JSON array in a hidden input. */
export function TagInput({ name, initial, placeholder }: { name: string; initial: string[]; placeholder: string }) {
  const [tags, setTags] = useState(initial);
  const [draft, setDraft] = useState("");

  const add = (raw: string) => {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    setTags((t) => [...t, ...parts.filter((p) => !t.some((x) => x.toLowerCase() === p.toLowerCase()))]);
    setDraft("");
  };

  return (
    <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl bg-surface p-1.5 ring-1 ring-transparent transition focus-within:bg-bg focus-within:ring-line-strong">
      <input type="hidden" name={name} value={JSON.stringify(tags)} />
      {tags.map((t) => (
        <span key={t} className="inline-flex h-8 items-center gap-1 rounded-full bg-bg pl-3 pr-1.5 text-compact font-semibold shadow-[0_0_0_1px_var(--line)]">
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => setTags(tags.filter((x) => x !== t))} className="grid size-5 place-items-center rounded-full text-fg-3 hover:bg-surface hover:text-fg">
            <XIcon className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => (e.target.value.endsWith(",") ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            setTags(tags.slice(0, -1));
          }
        }}
        onBlur={() => add(draft)}
        placeholder={tags.length ? "" : placeholder}
        className="h-8 min-w-32 flex-1 bg-transparent px-2 text-compact outline-none placeholder:text-fg-3"
      />
    </div>
  );
}
