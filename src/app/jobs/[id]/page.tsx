import Link from "next/link";
import { notFound } from "next/navigation";
import { setStatusAction } from "@/app/actions";
import { ApplyPanel } from "@/components/ApplyPanel";
import { ChevronLeft, ExternalIcon, PinIcon } from "@/components/icons";
import { formatDate, initials, modeLabel, timeAgo } from "@/lib/format";
import { applicationsForJob, getJob, type JobStatus } from "@/lib/jobs";
import { dailySendLimit, mailConfigured, resumePath } from "@/lib/mail";
import { fillTemplate, getSettings } from "@/lib/settings";
import { skillMatches } from "@/lib/agent/skills";

export const dynamic = "force-dynamic";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(Number(id));
  if (!job) notFound();

  const settings = getSettings();
  const applications = applicationsForJob(job.id);
  const firstName = job.posterName?.split(/\s+/)[0];
  const vars = {
    role: job.role,
    company: job.company ?? "your team",
    location: job.location,
    name: settings.profile.fullName,
    email: settings.profile.email,
    phone: settings.profile.phone,
    linkedin: settings.profile.linkedinUrl,
    portfolio: settings.profile.portfolioUrl,
    greeting_name: firstName && job.source !== "manual" ? firstName : "Hiring Team",
  };
  const resume = resumePath(settings);
  const yourSkills = skillMatches(`${job.role}\n${job.skills.join(", ")}\n${job.postText}`, settings.profile.skills);
  const facts = [
    job.location && { icon: true, text: job.location },
    modeLabel(job.workMode) && { text: modeLabel(job.workMode)! },
    job.experience && { text: job.experience },
    job.employmentType && { text: job.employmentType[0]!.toUpperCase() + job.employmentType.slice(1) },
  ].filter(Boolean) as { icon?: boolean; text: string }[];

  const statusButton = (status: JobStatus, label: string, activeLabel: string) => {
    const active = job.status === status;
    return (
      <form action={setStatusAction.bind(null, job.id, active ? "new" : status)}>
        <button className={active ? "btn-primary h-9 px-4" : "btn-secondary h-9 px-4"}>{active ? activeLabel : label}</button>
      </form>
    );
  };

  return (
    <div>
      <Link href="/" className="mb-8 inline-flex items-center gap-1 text-compact font-semibold text-fg-2 transition hover:text-fg">
        <ChevronLeft /> All openings
      </Link>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
        <article className="min-w-0">
          {job.company && <div className="mb-2 text-body font-semibold text-fg-2">{job.company}</div>}
          <h1 className="text-title-3 sm:text-title-2">{job.role}</h1>

          <div className="mt-4 flex flex-wrap gap-2">
            {facts.map((f) => (
              <span key={f.text} className="chip h-8 px-3.5 text-compact">
                {f.icon && <PinIcon />} {f.text}
              </span>
            ))}
            <span className="chip h-8 px-3.5 text-compact">
              {job.postedAt ? `Posted ${timeAgo(job.postedAt)}` : `Added ${timeAgo(job.foundAt)}`}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {statusButton("saved", "Save", "Saved")}
            {statusButton("ignored", "Not interested", "Ignored")}
          </div>

          {/* Rule-based summaries are just the post's opening, already shown below. */}
          {job.summary && job.extractedBy === "claude" && (
            <section className="mt-10">
              <h2 className="mb-2 text-feature">About the role</h2>
              <p className="text-body text-fg-2">{job.summary}</p>
            </section>
          )}

          {yourSkills.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-feature">Matches your skills</h2>
              <div className="flex flex-wrap gap-2">
                {yourSkills.map((s) => (
                  <span key={s} className="chip h-8 bg-positive-bg px-3.5 text-compact text-positive">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          {job.skills.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-3 text-feature">Skills the post asks for</h2>
              <div className="flex flex-wrap gap-2">
                {job.skills.map((s) => (
                  <span key={s} className="chip h-8 px-3.5 text-compact text-fg">
                    {s}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-3 text-feature">Original post</h2>
            <div className="rounded-[24px] border border-line p-5 sm:p-6">
              {job.posterName && (
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-strong text-compact font-semibold">
                    {initials(job.posterName)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-compact font-semibold">{job.posterName}</div>
                    {job.posterHeadline && <div className="truncate text-caption text-fg-2">{job.posterHeadline}</div>}
                  </div>
                </div>
              )}
              <p className="whitespace-pre-wrap break-words text-compact leading-6">{job.postText}</p>
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                {(job.postUrl ?? job.searchUrl) && (
                  <a href={job.postUrl ?? job.searchUrl!} target="_blank" rel="noreferrer" className="btn-secondary h-9 px-4">
                    {job.postUrl ? "Open post" : "Find post on LinkedIn"} <ExternalIcon />
                  </a>
                )}
                {job.posterUrl && (
                  <a href={job.posterUrl} target="_blank" rel="noreferrer" className="btn-secondary h-9 px-4">
                    Poster&apos;s profile <ExternalIcon />
                  </a>
                )}
              </div>
            </div>
            <p className="mt-3 text-caption text-fg-3">
              Found {formatDate(job.foundAt)} · {job.source === "manual" ? "added by you" : `from LinkedIn ${job.source}`} · read by{" "}
              {job.extractedBy === "claude" ? "Claude" : "built-in rules"}
            </p>
          </section>
        </article>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[24px] bg-surface p-5 sm:p-6">
            <h2 className="text-feature">Apply by email</h2>
            {job.applyEmail ? (
              <ApplyPanel
                jobId={job.id}
                emails={job.emails.length ? job.emails : [job.applyEmail]}
                defaultTo={job.applyEmail}
                defaultSubject={job.draftSubject ?? fillTemplate(settings.template.subject, vars).replace(/\s*[–—|-]\s*$/, "")}
                defaultBody={job.draftBody ?? fillTemplate(settings.template.body, vars)}
                tailored={Boolean(job.draftBody)}
                resumeName={resume ? resume.split("/").pop()!.replace(/^\d+-/, "") : null}
                mailReady={mailConfigured()}
                dailyLimit={dailySendLimit()}
                alreadySent={applications.some((a) => a.status === "sent")}
              />
            ) : (
              <p className="mt-2 text-compact text-fg-2">
                This post has no email address. Open it on LinkedIn to see how the poster wants to be contacted.
              </p>
            )}
          </div>

          {applications.length > 0 && (
            <div className="mt-4 rounded-[24px] border border-line p-5">
              <h3 className="mb-3 text-compact font-semibold">History</h3>
              <ul className="space-y-2">
                {applications.map((a) => (
                  <li key={a.id} className="text-caption">
                    <span className={a.status === "sent" ? "font-semibold text-positive" : "font-semibold text-negative"}>
                      {a.status === "sent" ? "Sent" : "Failed"}
                    </span>{" "}
                    to {a.toEmail} · {formatDate(a.sentAt)}
                    {a.error && <div className="mt-0.5 text-fg-3">{a.error}</div>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
