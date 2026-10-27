import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { formatDate } from "@/lib/format";
import { listApplications } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export default function ApplicationsPage() {
  const apps = listApplications();
  const sent = apps.filter((a) => a.status === "sent").length;

  return (
    <div>
      <h1 className="text-title-2 sm:text-title-1">Applications</h1>
      <p className="mt-2 text-body text-fg-2">
        {sent} sent{apps.length > sent ? ` · ${apps.length - sent} failed` : ""}
      </p>

      {apps.length === 0 ? (
        <div className="mt-8 rounded-[24px] bg-surface px-6 py-14 text-center">
          <h2 className="text-feature">Nothing sent yet</h2>
          <p className="mx-auto mt-2 max-w-md text-compact text-fg-2">
            Open an opening and use <b>Apply by email</b>. Everything you send shows up here.
          </p>
          <Link href="/" className="btn-primary mt-5">Browse openings</Link>
        </div>
      ) : (
        <ul className="mt-8 overflow-hidden rounded-[20px] border border-line">
          {apps.map((a) => (
            <li key={a.id} className="border-b border-line last:border-b-0">
              <Link href={`/jobs/${a.jobId}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold">{a.role}</div>
                  <div className="mt-1 truncate text-compact text-fg-2">
                    {[a.company, a.toEmail].filter(Boolean).join(" · ")}
                  </div>
                  {a.error && <div className="mt-1 truncate text-caption text-negative">{a.error}</div>}
                </div>
                <span className={`chip shrink-0 ${a.status === "sent" ? "bg-positive-bg text-positive" : "bg-negative-bg text-negative"}`}>
                  {a.status === "sent" ? "Sent" : "Failed"}
                </span>
                <span className="hidden w-40 shrink-0 text-right text-caption text-fg-3 sm:block">{formatDate(a.sentAt)}</span>
                <ChevronRight className="size-4 shrink-0 text-fg-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
