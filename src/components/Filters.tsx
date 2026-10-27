"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { SearchIcon } from "./icons";

const selectCls =
  "h-10 cursor-pointer appearance-none rounded-full bg-surface pl-4 pr-9 text-compact font-semibold text-fg outline-none transition hover:bg-surface-hover " +
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")] bg-[length:14px] bg-[right_14px_center] bg-no-repeat";

export function Filters({ roles, locations }: { roles: string[]; locations: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const qs = next.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const anyEmail = params.get("email") === "any";

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <label className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-3" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search role, company, skill…"
          className="h-10 w-full rounded-full bg-surface pl-11 pr-4 text-compact outline-none ring-1 ring-transparent transition placeholder:text-fg-3 hover:bg-surface-hover focus:bg-bg focus:ring-line-strong"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <select aria-label="Role" className={selectCls} value={params.get("role") ?? ""} onChange={(e) => update("role", e.target.value || null)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <select aria-label="Location" className={selectCls} value={params.get("location") ?? ""} onChange={(e) => update("location", e.target.value || null)}>
          <option value="">Any location</option>
          {locations.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select aria-label="Work mode" className={selectCls} value={params.get("mode") ?? ""} onChange={(e) => update("mode", e.target.value || null)}>
          <option value="">Any work mode</option>
          <option value="remote">Remote</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site</option>
        </select>
        <select aria-label="Posted" className={selectCls} value={params.get("days") ?? ""} onChange={(e) => update("days", e.target.value || null)}>
          <option value="">Any time</option>
          <option value="1">Past 24 hours</option>
          <option value="3">Past 3 days</option>
          <option value="7">Past week</option>
          <option value="30">Past month</option>
        </select>
        <select aria-label="Sort" className={selectCls} value={params.get("sort") ?? ""} onChange={(e) => update("sort", e.target.value || null)}>
          <option value="">Newest first</option>
          <option value="match">Best match</option>
        </select>
        <button
          type="button"
          onClick={() => update("email", anyEmail ? null : "any")}
          className={`h-10 rounded-full px-4 text-compact font-semibold transition ${
            anyEmail ? "bg-surface text-fg hover:bg-surface-hover" : "bg-inverse text-on-inverse hover:bg-inverse-hover"
          }`}
          aria-pressed={!anyEmail}
        >
          {anyEmail ? "With or without email" : "Has email"}
        </button>
      </div>
    </div>
  );
}
