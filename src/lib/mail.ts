import nodemailer from "nodemailer";
import fs from "node:fs";
import path from "node:path";
import { RESUME_DIR } from "./db";
import { recordApplication, sentInLast24h, setJobStatus, type Job } from "./jobs";
import type { Settings } from "./settings";

export function mailConfigured(): boolean {
  const pass = process.env.SMTP_PASS ?? "";
  return Boolean(process.env.SMTP_USER && pass && !pass.startsWith("PASTE_"));
}

export function dailySendLimit(): number {
  return Number(process.env.DAILY_SEND_LIMIT || 25);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    // Google shows App Passwords in groups ("abcd efgh …"); the spaces aren't part of it.
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS ?? "").replace(/\s+/g, "") },
  });
}

function from(settings: Settings): string {
  const name = settings.profile.fullName.replace(/"/g, "");
  return name ? `"${name}" <${process.env.SMTP_USER}>` : String(process.env.SMTP_USER);
}

export function resumePath(settings: Settings): string | null {
  if (!settings.profile.resumeFile) return null;
  const p = path.join(RESUME_DIR, path.basename(settings.profile.resumeFile));
  return fs.existsSync(p) ? p : null;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/** Gmail's login refusals, explained; anything else passes through unchanged. */
export function explainMailError(err: unknown): string {
  const msg = (err as Error).message ?? String(err);
  if (/534|535|Application-specific password|Username and Password not accepted|Invalid login/i.test(msg)) {
    return (
      "Gmail refused the login. Gmail only accepts a 16-letter App Password here, not your normal password: " +
      "create one at myaccount.google.com/apppasswords, put it in .env.local as SMTP_PASS, and restart the app."
    );
  }
  return msg;
}

export async function sendApplication(
  job: Job,
  draft: { to: string; subject: string; body: string },
  settings: Settings,
): Promise<SendResult> {
  if (!mailConfigured()) return { ok: false, error: "Email isn't set up yet. Add SMTP_USER and SMTP_PASS to .env.local." };
  if (sentInLast24h() >= dailySendLimit()) {
    return { ok: false, error: `You've reached today's limit of ${dailySendLimit()} applications. Try again tomorrow.` };
  }
  const resume = resumePath(settings);
  const replyTo = settings.profile.email || process.env.SMTP_USER;
  try {
    const info = await transport().sendMail({
      from: from(settings),
      to: draft.to,
      replyTo,
      subject: draft.subject,
      text: draft.body,
      attachments: resume ? [{ filename: path.basename(resume).replace(/^\d+-/, ""), path: resume }] : [],
    });
    recordApplication({
      jobId: job.id, toEmail: draft.to, subject: draft.subject, body: draft.body,
      resumeFile: resume ? path.basename(resume) : null, messageId: info.messageId ?? null, status: "sent", error: null,
    });
    setJobStatus(job.id, "applied");
    return { ok: true };
  } catch (err) {
    const error = explainMailError(err);
    recordApplication({
      jobId: job.id, toEmail: draft.to, subject: draft.subject, body: draft.body,
      resumeFile: null, messageId: null, status: "failed", error,
    });
    return { ok: false, error };
  }
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export async function sendDigest(jobs: Job[], settings: Settings): Promise<void> {
  const to = settings.notify.digestTo || settings.profile.email || process.env.SMTP_USER;
  if (!to) throw new Error("No address to send the digest to. Set it in Settings.");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  const lines = jobs.map((j) =>
    [
      `${j.role}${j.company ? ` — ${j.company}` : ""}`,
      [j.location, j.workMode, j.experience].filter(Boolean).join(" · "),
      j.applyEmail ? `Email: ${j.applyEmail}` : "No email in post",
      `${appUrl}/jobs/${j.id}`,
    ].join("\n"),
  );

  const rows = jobs
    .map(
      (j) => `<tr><td style="padding:14px 0;border-bottom:1px solid #eee">
        <a href="${appUrl}/jobs/${j.id}" style="color:#141414;font-weight:600;text-decoration:none;font-size:15px">${esc(j.role)}</a>
        <div style="color:#707070;font-size:13px;margin-top:2px">${esc([j.company, j.location, j.workMode, j.experience].filter(Boolean).join(" · "))}</div>
        ${j.applyEmail ? `<div style="font-size:13px;margin-top:6px">✉ <a href="mailto:${esc(j.applyEmail)}" style="color:#0055ff">${esc(j.applyEmail)}</a></div>` : ""}
      </td></tr>`,
    )
    .join("");

  await transport().sendMail({
    from: from(settings),
    to,
    subject: `${jobs.length} new opening${jobs.length === 1 ? "" : "s"} from LinkedIn`,
    text: `New openings found on LinkedIn:\n\n${lines.join("\n\n")}\n\nAll openings: ${appUrl}`,
    html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
      <h2 style="font-size:20px;margin:0 0 4px">${jobs.length} new opening${jobs.length === 1 ? "" : "s"}</h2>
      <p style="color:#707070;margin:0 0 8px;font-size:14px">Found in LinkedIn posts. Open one to read the post and apply.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin-top:20px"><a href="${appUrl}" style="background:#141414;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-size:14px">Open all openings</a></p>
    </div>`,
  });
}

export async function sendTestEmail(settings: Settings): Promise<SendResult> {
  if (!mailConfigured()) return { ok: false, error: "Add SMTP_USER and SMTP_PASS to .env.local, then restart the app." };
  const to = settings.profile.email || process.env.SMTP_USER!;
  try {
    await transport().sendMail({
      from: from(settings),
      to,
      subject: "Link Agent: email is working",
      text: "This test email confirms Link Agent can send from your account.",
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: explainMailError(err) };
  }
}
