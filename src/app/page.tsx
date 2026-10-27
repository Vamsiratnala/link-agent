import Link from "next/link";
import { Filters } from "@/components/Filters";
import { GetJobsButton } from "@/components/GetJobsButton";
import { runStatus } from "@/lib/runner";
import { ChevronRight, MailIcon } from "@/components/icons";
import { JOB_STATUSES, knownLocations, lastRun, listJobs, statusCounts, type Job, type JobFilters, type JobStatus } from "@/lib/jobs";
import { modeLabel, timeAgo } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { skillMatches } from "@/lib/agent/skills";

export const dynamic = "force-dynamic";

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

const TABS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "saved", label: "Saved" },
  { value: "applied", label: "Applied" },
  { value: "ignored", label: "Ignored" },
];

export default async function OpeningsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const status: JobStatus | "all" = (JOB_STATUSES as readonly string[]).includes(one(sp.status) ?? "")
    ? (one(sp.status) as JobStatus)
    : "all";
  const filters: JobFilters = {
    q: one(sp.q),
    status,
    role: one(sp.role),
    location: one(sp.location),
    mode: one(sp.mode),
    days: Number(one(sp.days)) || undefined,
    hasEmail: one(sp.email) !== "any",
    sort: one(sp.sort) === "match" ? "match" : "newest",
  };
  const jobs = listJobs(filters);
  const counts = statusCounts();
  const settings = getSettings();
  const run = lastRun();

  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = job.matchedRole ?? "Other roles";
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    const rank = (r: string) => (r === "Other roles" ? 999 : settings.search.roles.indexOf(r));
    return rank(a) - rank(b);
  });

  const tabHref = (value: string) => {
    const p = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (one(v) ? [[k, one(v)!]] : [])));
    if (value === "all") p.delete("status");
    else p.set("status", value);
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <div>
      <section className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-title-2 sm:text-title-1">Openings</h1>
          <p className="mt-2 text-body text-fg-2">
            {counts.all} role{counts.all === 1 ? "" : "s"} found in LinkedIn posts
            {run ? ` · last search ${timeAgo(run.finishedAt)}` : ""}
          </p>
        </div>
        <GetJobsButton initial={runStatus()} />
      </section>

      <div className="mb-5 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = status === t.value;
          return (
            <Link
              key={t.value}
              href={tabHref(t.value)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-compact font-semibold transition ${
                active ? "bg-inverse text-on-inverse" : "bg-surface text-fg hover:bg-surface-hover"
              }`}
            >
              {t.label}
              <span className={active ? "opacity-70" : "text-fg-3"}>{counts[t.value]}</span>
            </Link>
          );
        })}
      </div>

      <Filters roles={settings.search.roles} locations={[...new Set([...settings.search.locations, ...knownLocations()])]} />

      {jobs.length === 0 ? (
        <EmptyState hasAny={counts.all + counts.ignored > 0} />
      ) : (
        <div className="mt-8 space-y-10">
          {ordered.map(([role, list]) => (
            <section key={role}>
              <h2 className="mb-3 flex items-baseline gap-2 text-feature">
                {role}
                <span className="text-compact font-semibold text-fg-3">{list.length}</span>
              </h2>
              <ul className="overflow-hidden rounded-[20px] border border-line">
                {list.map((job) => (
                  <JobRow
                    key={job.id}
                    job={job}
                    skillCount={skillMatches(`${job.role}\n${job.skills.join(", ")}\n${job.postText}`, settings.profile.skills).length}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, skillCount }: { job: Job; skillCount: number }) {
  const meta = [job.company, job.location, modeLabel(job.workMode), job.experience].filter(Boolean);
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/jobs/${job.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-body font-semibold">{job.role}</span>
            {job.status === "new" && <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-label="new" />}
            {job.status === "saved" && <span className="chip h-6">Saved</span>}
            {job.status === "applied" && <span className="chip h-6 bg-positive-bg text-positive">Applied</span>}
          </div>
          <div className="mt-1 truncate text-compact text-fg-2">{meta.join(" · ") || "Details in post"}</div>
        </div>
        <div className="hidden shrink-0 items-center gap-3 sm:flex">
          {skillCount > 0 && (
            <span className="chip" title="Your skills this post asks for">
              {skillCount} skill{skillCount === 1 ? "" : "s"}
            </span>
          )}
          {job.applyEmail && (
            <span className="chip">
              <MailIcon /> Email
            </span>
          )}
          <span className="w-16 text-right text-caption text-fg-3">{timeAgo(job.postedAt ?? job.foundAt)}</span>
        </div>
        <ChevronRight className="size-4 shrink-0 text-fg-3 transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </Link>
    </li>
  );
}

function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="mt-8 rounded-[24px] bg-surface px-6 py-14 text-center">
      <h2 className="text-feature">{hasAny ? "No openings match these filters" : "No openings yet"}</h2>
      <p className="mx-auto mt-2 max-w-md text-compact text-fg-2">
        {hasAny ? (
          "Try clearing a filter, or include posts without an email."
        ) : (
          <>
            Click <b>Get jobs</b>. Claude searches LinkedIn in your Chrome and saves hiring posts here, each with an email written
            for it. You can also{" "}
            <Link href="/add" className="font-semibold text-fg underline underline-offset-2">
              paste a post
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}
