import Link from "next/link";
import { lastRun } from "@/lib/jobs";
import { timeAgo } from "@/lib/format";
import { NavLinks } from "./NavLinks";

export function Nav() {
  const run = lastRun();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-[10px] bg-inverse text-[15px] font-bold text-on-inverse">L</span>
          <span className="hidden text-body font-semibold sm:inline">Link Agent</span>
        </Link>
        <NavLinks />
        <div className="ml-auto hidden text-caption text-fg-2 md:block" title={run?.note ?? undefined}>
          {run ? `Last search ${timeAgo(run.finishedAt)} · ${run.newJobs} new` : "No searches yet"}
        </div>
      </div>
    </header>
  );
}
