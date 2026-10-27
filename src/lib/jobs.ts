import { z } from "zod";
import { db } from "./db";
import { extractEmails, pickApplyEmail } from "./agent/emails";
import { matchRole, postedAtFromAge, postSearchUrl, scoreOpening } from "./agent/match";
import { skillMatches } from "./agent/skills";
import type { Settings } from "./settings";

export const JOB_STATUSES = ["new", "saved", "applied", "ignored"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type Job = {
  id: number;
  postKey: string;
  source: string;
  role: string;
  company: string | null;
  location: string | null;
  workMode: string | null;
  experience: string | null;
  employmentType: string | null;
  summary: string | null;
  skills: string[];
  emails: string[];
  applyEmail: string | null;
  posterName: string | null;
  posterHeadline: string | null;
  posterUrl: string | null;
  postUrl: string | null;
  searchUrl: string | null;
  postText: string;
  postedAt: string | null;
  foundAt: string;
  matchedRole: string | null;
  score: number;
  status: JobStatus;
  extractedBy: string;
  /** An application email written for this opening; null means use the general template. */
  draftSubject: string | null;
  draftBody: string | null;
};

type Row = Record<string, string | number | null>;

function toJob(r: Row): Job {
  return {
    id: Number(r.id),
    postKey: String(r.post_key),
    source: String(r.source),
    role: String(r.role),
    company: r.company as string | null,
    location: r.location as string | null,
    workMode: r.work_mode as string | null,
    experience: r.experience as string | null,
    employmentType: r.employment_type as string | null,
    summary: r.summary as string | null,
    skills: JSON.parse(String(r.skills)),
    emails: JSON.parse(String(r.emails)),
    applyEmail: r.apply_email as string | null,
    posterName: r.poster_name as string | null,
    posterHeadline: r.poster_headline as string | null,
    posterUrl: r.poster_url as string | null,
    postUrl: r.post_url as string | null,
    searchUrl: r.search_url as string | null,
    postText: String(r.post_text),
    postedAt: r.posted_at as string | null,
    foundAt: String(r.found_at),
    matchedRole: r.matched_role as string | null,
    score: Number(r.score),
    status: r.status as JobStatus,
    extractedBy: String(r.extracted_by),
    draftSubject: r.draft_subject as string | null,
    draftBody: r.draft_body as string | null,
  };
}

export type JobFilters = {
  q?: string;
  status?: JobStatus | "all";
  role?: string;
  location?: string;
  mode?: string;
  days?: number;
  hasEmail?: boolean;
  sort?: "newest" | "match";
};

export function listJobs(f: JobFilters = {}): Job[] {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.status && f.status !== "all") {
    where.push("status = ?");
    params.push(f.status);
  } else {
    where.push("status != 'ignored'");
  }
  if (f.q) {
    where.push("(role LIKE ? OR company LIKE ? OR location LIKE ? OR post_text LIKE ?)");
    const like = `%${f.q}%`;
    params.push(like, like, like, like);
  }
  if (f.role) {
    where.push("matched_role = ?");
    params.push(f.role);
  }
  if (f.location) {
    where.push("(location LIKE ? OR (? = 'Remote' AND work_mode = 'remote'))");
    params.push(`%${f.location}%`, f.location);
  }
  if (f.mode) {
    where.push("work_mode = ?");
    params.push(f.mode);
  }
  if (f.days) {
    where.push("COALESCE(posted_at, found_at) >= ?");
    params.push(new Date(Date.now() - f.days * 864e5).toISOString());
  }
  if (f.hasEmail) where.push("apply_email IS NOT NULL");
  const order = f.sort === "match" ? "score DESC, COALESCE(posted_at, found_at) DESC" : "COALESCE(posted_at, found_at) DESC, score DESC";
  const sql = `SELECT * FROM jobs WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT 500`;
  return (db().prepare(sql).all(...params) as Row[]).map(toJob);
}

export function getJob(id: number): Job | null {
  const row = db().prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Row | undefined;
  return row ? toJob(row) : null;
}

export function setJobStatus(id: number, status: JobStatus): void {
  db().prepare("UPDATE jobs SET status = ? WHERE id = ?").run(status, id);
}

export function statusCounts(): Record<JobStatus | "all", number> {
  const rows = db().prepare("SELECT status, COUNT(*) AS n FROM jobs GROUP BY status").all() as { status: JobStatus; n: number }[];
  const counts = { all: 0, new: 0, saved: 0, applied: 0, ignored: 0 };
  for (const r of rows) {
    counts[r.status] = Number(r.n);
    if (r.status !== "ignored") counts.all += Number(r.n);
  }
  return counts;
}

export function knownLocations(): string[] {
  const rows = db()
    .prepare("SELECT location, COUNT(*) AS n FROM jobs WHERE location IS NOT NULL GROUP BY location ORDER BY n DESC LIMIT 30")
    .all() as { location: string }[];
  return rows.map((r) => r.location);
}

// ── Adding openings (called by the /find-jobs agent through scripts/openings.ts) ──

const nullableText = z.string().trim().nullish().transform((v) => (v ? v : null));

export const OpeningInput = z.object({
  key: z.string().min(4),
  source: z.enum(["search", "feed", "manual"]).default("search"),
  role: z.string().trim().min(1),
  company: nullableText,
  location: nullableText,
  workMode: z.enum(["remote", "hybrid", "onsite"]).nullish().transform((v) => v ?? null),
  experience: nullableText,
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]).nullish().transform((v) => v ?? null),
  applyEmail: nullableText,
  emails: z.array(z.string()).default([]),
  skills: z.array(z.string()).default([]),
  summary: z.string().default(""),
  posterName: nullableText,
  posterHeadline: nullableText,
  posterUrl: nullableText,
  postUrl: nullableText,
  postedAge: nullableText,
  text: z.string().min(20),
  extractedBy: z.enum(["claude", "rules"]).default("claude"),
  draftSubject: nullableText,
  draftBody: nullableText,
});
export type OpeningInput = z.input<typeof OpeningInput>;

export type AddResult = { key: string; result: "added" | "duplicate" | "rejected-before" | "excluded"; id?: number };

export function addOpening(raw: OpeningInput, settings: Settings): AddResult {
  const search = settings.search;
  const o = OpeningInput.parse(raw);
  const conn = db();
  if (conn.prepare("SELECT 1 FROM jobs WHERE post_key = ?").get(o.key)) return { key: o.key, result: "duplicate" };
  if (conn.prepare("SELECT 1 FROM rejected_posts WHERE post_key = ?").get(o.key)) return { key: o.key, result: "rejected-before" };

  const lowered = o.text.toLowerCase();
  if (search.excludeKeywords.some((k) => k && lowered.includes(k.toLowerCase()))) {
    rejectPost(o.key, "excluded keyword");
    return { key: o.key, result: "excluded" };
  }

  // Never trust an address that isn't actually in the post.
  const found = [...new Set([...o.emails.map((e) => e.toLowerCase().trim()), ...extractEmails(o.text)])];
  const claimed = o.applyEmail?.toLowerCase() ?? null;
  const applyEmail = claimed && found.includes(claimed) ? claimed : pickApplyEmail(found, o.text);

  const matched = matchRole(o.role, o.text, search.roles);
  const skills = skillMatches(`${o.role}\n${o.skills.join(", ")}\n${o.text}`, settings.profile.skills);
  const score = scoreOpening({ ...o, applyEmail }, matched, search, skills);
  const now = new Date().toISOString();

  const info = conn
    .prepare(
      `INSERT INTO jobs (post_key, source, role, company, location, work_mode, experience, employment_type,
        summary, skills, emails, apply_email, poster_name, poster_headline, poster_url, post_url, search_url,
        post_text, posted_at, found_at, matched_role, score, extracted_by, draft_subject, draft_body)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      o.key, o.source, o.role, o.company, o.location, o.workMode, o.experience, o.employmentType,
      o.summary, JSON.stringify(o.skills.slice(0, 10)), JSON.stringify(found), applyEmail,
      o.posterName, o.posterHeadline, o.posterUrl, o.postUrl, postSearchUrl(o.text),
      o.text, postedAtFromAge(o.postedAge) ?? (o.source === "manual" ? null : now), now, matched, score, o.extractedBy,
      o.draftSubject, o.draftBody,
    );
  return { key: o.key, result: "added", id: Number(info.lastInsertRowid) };
}

// ── Tailored application drafts ──

export const DraftInput = z.object({
  id: z.number().int().positive(),
  subject: z.string().trim().min(3),
  body: z.string().trim().min(40),
});

export function setDraft(d: z.input<typeof DraftInput>): boolean {
  const { id, subject, body } = DraftInput.parse(d);
  return db().prepare("UPDATE jobs SET draft_subject = ?, draft_body = ? WHERE id = ?").run(subject, body, id).changes > 0;
}

/** Openings still using the general template (or every unapplied one when `all`). */
export function jobsNeedingDraft(all = false): Job[] {
  const where = all ? "status != 'applied'" : "draft_body IS NULL AND status != 'applied'";
  return (db().prepare(`SELECT * FROM jobs WHERE ${where} AND apply_email IS NOT NULL ORDER BY id`).all() as Row[]).map(toJob);
}

export { unfilledPlaceholders } from "./placeholders";

export function rejectPost(key: string, reason: string): void {
  db()
    .prepare("INSERT OR IGNORE INTO rejected_posts (post_key, reason, seen_at) VALUES (?, ?, ?)")
    .run(key, reason, new Date().toISOString());
}

/** Fingerprints of posts already saved or rejected recently, so the agent skips them in the browser. */
export function recentKeys(days = 30): string[] {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const rows = db()
    .prepare(
      "SELECT post_key AS k FROM jobs WHERE found_at >= ? UNION SELECT post_key AS k FROM rejected_posts WHERE seen_at >= ?",
    )
    .all(since, since) as { k: string }[];
  return rows.map((r) => r.k);
}

export function unnotifiedJobs(): Job[] {
  return (db().prepare("SELECT * FROM jobs WHERE notified = 0 AND status = 'new' ORDER BY score DESC").all() as Row[]).map(toJob);
}

export function markNotified(ids: number[]): void {
  const stmt = db().prepare("UPDATE jobs SET notified = 1 WHERE id = ?");
  for (const id of ids) stmt.run(id);
}

// ── Runs ──

export type Run = { finishedAt: string; searches: number; postsSeen: number; newJobs: number; note: string | null };

export function logRun(r: Omit<Run, "finishedAt">): void {
  db()
    .prepare("INSERT INTO runs (finished_at, searches, posts_seen, new_jobs, note) VALUES (?, ?, ?, ?, ?)")
    .run(new Date().toISOString(), r.searches, r.postsSeen, r.newJobs, r.note);
}

export function lastRun(): Run | null {
  const r = db().prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 1").get() as Row | undefined;
  if (!r) return null;
  return {
    finishedAt: String(r.finished_at),
    searches: Number(r.searches),
    postsSeen: Number(r.posts_seen),
    newJobs: Number(r.new_jobs),
    note: r.note as string | null,
  };
}

// ── Applications ──

export type Application = {
  id: number;
  jobId: number;
  role: string;
  company: string | null;
  toEmail: string;
  subject: string;
  sentAt: string;
  status: string;
  error: string | null;
};

export function recordApplication(a: {
  jobId: number; toEmail: string; subject: string; body: string; resumeFile: string | null;
  messageId: string | null; status: "sent" | "failed"; error: string | null;
}): void {
  db()
    .prepare(
      `INSERT INTO applications (job_id, to_email, subject, body, resume_file, sent_at, message_id, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(a.jobId, a.toEmail, a.subject, a.body, a.resumeFile, new Date().toISOString(), a.messageId, a.status, a.error);
}

export function listApplications(): Application[] {
  const rows = db()
    .prepare(
      `SELECT a.id, a.job_id, j.role, j.company, a.to_email, a.subject, a.sent_at, a.status, a.error
       FROM applications a JOIN jobs j ON j.id = a.job_id ORDER BY a.sent_at DESC`,
    )
    .all() as Row[];
  return rows.map((r) => ({
    id: Number(r.id),
    jobId: Number(r.job_id),
    role: String(r.role),
    company: r.company as string | null,
    toEmail: String(r.to_email),
    subject: String(r.subject),
    sentAt: String(r.sent_at),
    status: String(r.status),
    error: r.error as string | null,
  }));
}

export function applicationsForJob(jobId: number): Application[] {
  return listApplications().filter((a) => a.jobId === jobId);
}

export function sentInLast24h(): number {
  const since = new Date(Date.now() - 864e5).toISOString();
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM applications WHERE status = 'sent' AND sent_at >= ?")
    .get(since) as { n: number };
  return Number(row.n);
}
