"use server";

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { RESUME_DIR } from "@/lib/db";
import { extractWithRules } from "@/lib/agent/rules";
import { addOpening, getJob, JOB_STATUSES, setDraft, setJobStatus, type JobStatus } from "@/lib/jobs";
import { sendApplication, sendTestEmail } from "@/lib/mail";
import { unfilledPlaceholders } from "@/lib/placeholders";
import { getSettings, saveSettings, type Recency, type Settings } from "@/lib/settings";

export type ActionState = { ok: boolean; message: string } | null;

export async function setStatusAction(id: number, status: JobStatus) {
  if (!JOB_STATUSES.includes(status)) return;
  setJobStatus(id, status);
  revalidatePath("/", "layout");
}

/** Keep the email you're working on for an opening, so it's there when you come back. */
export async function saveDraftAction(jobId: number, subject: string, body: string): Promise<void> {
  if (subject.trim().length < 3 || body.trim().length < 40) return;
  setDraft({ id: jobId, subject, body });
}

export async function applyAction(_: ActionState, form: FormData): Promise<ActionState> {
  const job = getJob(Number(form.get("jobId")));
  if (!job) return { ok: false, message: "This opening no longer exists." };
  const to = String(form.get("to") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  if (!job.emails.includes(to) && to !== job.applyEmail) {
    return { ok: false, message: "Pick one of the addresses from the post." };
  }
  if (!subject || !body) return { ok: false, message: "Subject and message can't be empty." };
  const gaps = unfilledPlaceholders(`${subject}\n${body}`);
  if (gaps.length) return { ok: false, message: `Fill in ${gaps.join(", ")} before sending.` };
  const result = await sendApplication(job, { to, subject, body }, getSettings());
  revalidatePath("/", "layout");
  return result.ok ? { ok: true, message: `Sent to ${to}.` } : { ok: false, message: result.error };
}

const list = (v: FormDataEntryValue | null): string[] => {
  try {
    const parsed = JSON.parse(String(v ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String).map((s) => s.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
};
const text = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const clamp = (v: FormDataEntryValue | null, lo: number, hi: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  const current = getSettings();
  let resumeFile = current.profile.resumeFile;

  const upload = form.get("resume");
  if (upload instanceof File && upload.size > 0) {
    if (!/\.(pdf|docx?)$/i.test(upload.name)) return { ok: false, message: "Resume must be a PDF or Word file." };
    if (upload.size > 8 * 1024 * 1024) return { ok: false, message: "Resume must be under 8 MB." };
    fs.mkdirSync(RESUME_DIR, { recursive: true });
    const safe = upload.name.replace(/[^\w.-]+/g, "_");
    const name = `${Date.now()}-${safe}`;
    fs.writeFileSync(path.join(RESUME_DIR, name), Buffer.from(await upload.arrayBuffer()));
    if (resumeFile) fs.rmSync(path.join(RESUME_DIR, path.basename(resumeFile)), { force: true });
    resumeFile = name;
  }

  const roles = list(form.get("roles"));
  if (roles.length === 0) return { ok: false, message: "Add at least one role to search for." };
  const recency = text(form.get("recency")) as Recency;

  const next: Settings = {
    profile: {
      fullName: text(form.get("fullName")),
      email: text(form.get("email")),
      phone: text(form.get("phone")),
      linkedinUrl: text(form.get("linkedinUrl")),
      portfolioUrl: text(form.get("portfolioUrl")),
      resumeFile,
      skills: list(form.get("skills")),
      resumeText: String(form.get("resumeText") ?? "").trim(),
    },
    search: {
      roles,
      locations: list(form.get("locations")),
      keywords: list(form.get("keywords")),
      excludeKeywords: list(form.get("excludeKeywords")),
      recency: ["past-24h", "past-week", "past-month"].includes(recency) ? recency : current.search.recency,
      maxSearchesPerRun: clamp(form.get("maxSearchesPerRun"), 1, 20, current.search.maxSearchesPerRun),
      maxPostsPerRun: clamp(form.get("maxPostsPerRun"), 5, 100, current.search.maxPostsPerRun),
      scanFeed: form.get("scanFeed") === "on",
      includeNoEmail: form.get("includeNoEmail") === "on",
      maxYearsExperience: text(form.get("maxYearsExperience")) === "" ? null : clamp(form.get("maxYearsExperience"), 0, 30, 0),
    },
    notify: {
      digestEnabled: form.get("digestEnabled") === "on",
      digestTo: text(form.get("digestTo")),
    },
    template: {
      subject: text(form.get("subject")) || current.template.subject,
      body: String(form.get("body") ?? "").trim() || current.template.body,
    },
  };
  saveSettings(next);
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

export async function testEmailAction(_: ActionState): Promise<ActionState> {
  const r = await sendTestEmail(getSettings());
  return r.ok ? { ok: true, message: "Test email sent. Check your inbox." } : { ok: false, message: r.error };
}

export async function addPostAction(_: ActionState, form: FormData): Promise<ActionState> {
  const post = String(form.get("text") ?? "").trim();
  if (post.length < 40) return { ok: false, message: "Paste the full post text (at least a couple of sentences)." };
  const settings = getSettings();
  const read = extractWithRules(post, settings.search.roles, settings.search.locations);
  const override = (k: string) => text(form.get(k)) || null;
  const key = `m-${crypto.createHash("sha1").update(post.toLowerCase().replace(/\s+/g, " ")).digest("hex").slice(0, 16)}`;

  const result = addOpening(
    {
      key,
      source: "manual",
      role: override("role") ?? read.role,
      company: override("company") ?? read.company,
      location: override("location") ?? read.location,
      workMode: read.workMode,
      experience: read.experience,
      employmentType: read.employmentType,
      applyEmail: override("applyEmail") ?? read.applyEmail,
      emails: read.emails,
      skills: [],
      summary: read.summary,
      postUrl: override("postUrl"),
      text: post,
      extractedBy: "rules",
    },
    { ...settings, search: { ...settings.search, excludeKeywords: [] } },
  );
  if (result.result === "duplicate") return { ok: false, message: "This post is already in your openings." };
  if (result.result !== "added" || !result.id) return { ok: false, message: "Couldn't add this post." };
  revalidatePath("/", "layout");
  redirect(`/jobs/${result.id}`);
}
