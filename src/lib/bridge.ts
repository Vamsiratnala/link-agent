/**
 * What the /find-jobs and /draft-emails agents can do to the app's data.
 * Shared by the Link Agent MCP server (scripts/mcp-server.ts), which agents
 * use, and the `openings` CLI (scripts/openings.ts), for running by hand.
 */
import path from "node:path";
import { z } from "zod";
import { kvGet, kvSet, RESUME_DIR } from "./db";
import {
  addOpening, jobsNeedingDraft, logRun, markNotified, recentKeys, rejectPost, setDraft, unfilledPlaceholders,
  unnotifiedJobs, type AddResult,
} from "./jobs";
import { explainMailError, mailConfigured, sendDigest } from "./mail";
import { getSettings, type Settings } from "./settings";

function searchUrl(role: string, location: string, s: Settings["search"]): string {
  const keywords = ["hiring", role, location, ...s.keywords].filter(Boolean).join(" ");
  const u = new URL("https://www.linkedin.com/search/results/content/");
  u.searchParams.set("keywords", keywords);
  u.searchParams.set("datePosted", JSON.stringify(s.recency));
  u.searchParams.set("sortBy", JSON.stringify("date_posted"));
  return u.toString();
}

function resumePath(p: Settings["profile"]): string | null {
  return p.resumeFile ? path.join(RESUME_DIR, path.basename(p.resumeFile)) : null;
}

/** The next batch of role × location searches, continuing where the last run stopped. */
export function plan() {
  const { search: s, profile: p } = getSettings();
  const combos = s.roles.flatMap((role) => (s.locations.length ? s.locations : [""]).map((location) => ({ role, location })));
  const count = Math.min(Math.max(1, s.maxSearchesPerRun), combos.length);
  const cursor = combos.length ? Number(kvGet("search_cursor") ?? 0) % combos.length : 0;
  const picked = Array.from({ length: count }, (_, i) => combos[(cursor + i) % combos.length]);
  if (combos.length) kvSet("search_cursor", String((cursor + count) % combos.length));

  return {
    targetRoles: s.roles,
    targetLocations: s.locations,
    excludeKeywords: s.excludeKeywords,
    you: { name: p.fullName, email: p.email, phone: p.phone, linkedin: p.linkedinUrl, portfolio: p.portfolioUrl },
    yourSkills: p.skills,
    resumePath: resumePath(p),
    includeNoEmail: s.includeNoEmail,
    maxYearsExperience: s.maxYearsExperience,
    maxPostsPerRun: s.maxPostsPerRun,
    scanFeed: s.scanFeed,
    searches: picked.map((c) => ({ ...c, url: searchUrl(c.role, c.location, s) })),
    feedUrl: "https://www.linkedin.com/feed/",
    seenKeys: recentKeys(),
  };
}

export type AddOutcome = AddResult | { key: unknown; result: "invalid"; error: string };

export function addOpenings(items: unknown[]): { added: number; results: AddOutcome[] } {
  const settings = getSettings();
  const results: AddOutcome[] = items.map((item) => {
    try {
      return addOpening(item as Parameters<typeof addOpening>[0], settings);
    } catch (err) {
      const error = err instanceof z.ZodError ? z.prettifyError(err) : (err as Error).message;
      return { key: (item as { key?: unknown })?.key, result: "invalid", error: error.slice(0, 300) };
    }
  });
  return { added: results.filter((r) => r.result === "added").length, results };
}

export function rejectPosts(items: { key: string; reason?: string }[]): { rejected: number } {
  let n = 0;
  for (const it of items) {
    if (!it?.key) continue;
    rejectPost(it.key, it.reason || "not a fit");
    n++;
  }
  return { rejected: n };
}

export async function digest(): Promise<string> {
  const settings = getSettings();
  if (!settings.notify.digestEnabled) return "Digest is turned off in Settings.";
  if (!mailConfigured()) return "Digest skipped: email isn't set up yet (SMTP_USER / SMTP_PASS in .env.local).";
  const jobs = unnotifiedJobs();
  if (jobs.length === 0) return "No new openings to email.";
  try {
    await sendDigest(jobs, settings);
  } catch (err) {
    return `Digest not sent: ${explainMailError(err)}`;
  }
  markNotified(jobs.map((j) => j.id));
  return `Emailed a digest of ${jobs.length} new opening${jobs.length === 1 ? "" : "s"}.`;
}

export async function finishRun(r: { searches: number; seen: number; added: number; note?: string | null }): Promise<string> {
  logRun({ searches: r.searches, postsSeen: r.seen, newJobs: r.added, note: r.note ?? null });
  return digest();
}

export function openingsNeedingDrafts(opts: { all?: boolean; ids?: number[] } = {}) {
  const ids = opts.ids?.length ? opts.ids : undefined;
  const jobs = jobsNeedingDraft(Boolean(opts.all) || Boolean(ids)).filter((j) => !ids || ids.includes(j.id));
  const p = getSettings().profile;
  return {
    you: {
      name: p.fullName, email: p.email, phone: p.phone, linkedin: p.linkedinUrl, portfolio: p.portfolioUrl,
      skills: p.skills, resumePath: resumePath(p),
    },
    openings: jobs.map((j) => ({
      id: j.id, role: j.role, company: j.company, location: j.location, experience: j.experience,
      posterName: j.posterName, applyEmail: j.applyEmail, skills: j.skills, summary: j.summary, postText: j.postText,
    })),
  };
}

export function saveDrafts(items: { id: number; subject: string; body: string }[]) {
  return items.map((d) => {
    try {
      const saved = setDraft(d);
      return { id: d.id, result: saved ? "saved" : "no such opening", toFillIn: unfilledPlaceholders(`${d.subject}\n${d.body}`) };
    } catch (err) {
      return { id: d.id, result: "invalid", error: err instanceof z.ZodError ? z.prettifyError(err) : (err as Error).message };
    }
  });
}
