import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { RESUME_DIR } from "./db";
import type { Job } from "./jobs";
import type { Settings } from "./settings";

/**
 * The email assistant on each job page. Each request runs a short, tool-free
 * headless Claude Code call (your Pro plan) with your resume, the job post,
 * the current email and the conversation so far, and returns a revised email.
 */

export type ChatTurn = { role: "user" | "assistant"; content: string };
export type AssistantResult = { reply: string; subject: string; body: string };

const SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    reply: { type: "string", description: "One or two sentences to the user: what you changed, or the answer to their question." },
    subject: { type: "string", description: "The full email subject after your change (unchanged if no change was needed)." },
    body: { type: "string", description: "The full email body after your change, including the sign-off (unchanged if no change was needed)." },
  },
  required: ["reply", "subject", "body"],
  additionalProperties: false,
});

/** The email-writing rules shared with /find-jobs and /draft-emails. */
function writingRules(): string {
  const file = path.join(process.cwd(), ".claude", "commands", "draft-emails.md");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const start = text.indexOf("## How to write the email");
  return start === -1 ? "" : text.slice(start).replace(/^## /m, "");
}

function system(hasResumeText: boolean): string {
  return `You are the email assistant inside Link Agent, helping the user tailor a job application email they will send from their own Gmail.

You can see the user's resume, the job post, the current email and your conversation with the user. Each time, do what the user asks: rewrite the email (simplify, elaborate, shorten, change tone, emphasise something, answer the post's questions) or answer a question about it.

Always return the complete email (subject and body). If the user only asked a question, answer it in "reply" and return the email unchanged.

Keep these rules from the user's email guidelines:
${writingRules()}

Hard rules, whatever the user asks:
- Every claim about the user must come from the resume or contact details. Never invent experience, numbers, skills, employers or dates. If the user asks you to add something the resume doesn't support, say so in "reply" and leave it out, or add a [bracketed gap] for them to fill.
- Keep any [bracketed gaps] that are still unfilled, and keep the sign-off.
- Plain text only: no markdown, no emojis.${hasResumeText ? "" : "\n- The resume is a PDF: read it with the Read tool before writing."}`;
}

function prompt(job: Job, settings: Settings, email: { subject: string; body: string }, history: ChatTurn[], instruction: string): string {
  const p = settings.profile;
  const resume = p.resumeText.trim()
    ? p.resumeText
    : `(Read the PDF at ${p.resumeFile ? path.join(RESUME_DIR, path.basename(p.resumeFile)) : "— no resume uploaded"})`;
  const convo = history.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n");
  return `<user_contact>
Name: ${p.fullName}
Email: ${p.email}
Phone: ${p.phone}
LinkedIn: ${p.linkedinUrl}${p.portfolioUrl ? `\nPortfolio: ${p.portfolioUrl}` : ""}
</user_contact>

<resume>
${resume}
</resume>

<job_post role="${job.role}" company="${job.company ?? ""}" location="${job.location ?? ""}" experience="${job.experience ?? ""}" poster="${job.posterName ?? ""}">
${job.postText}
</job_post>

<current_email>
Subject: ${email.subject}

${email.body}
</current_email>
${convo ? `\n<conversation_so_far>\n${convo}\n</conversation_so_far>\n` : ""}
<request>
${instruction}
</request>`;
}

function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const local = path.join(os.homedir(), ".local", "bin", "claude");
  return fs.existsSync(local) ? local : "claude";
}

export async function rewriteEmail(
  job: Job,
  settings: Settings,
  email: { subject: string; body: string },
  history: ChatTurn[],
  instruction: string,
): Promise<AssistantResult> {
  const hasResumeText = Boolean(settings.profile.resumeText.trim());
  const args = [
    "-p", prompt(job, settings, email, history.slice(-12), instruction),
    "--system-prompt", system(hasResumeText),
    "--json-schema", SCHEMA,
    "--output-format", "json",
    "--strict-mcp-config",
    "--no-session-persistence",
    // Writing only. With no resume text, allow reading the resume PDF and nothing else.
    "--tools", hasResumeText ? "" : "Read",
    ...(hasResumeText ? [] : ["--allowedTools", "Read", "--add-dir", RESUME_DIR]),
  ];

  const out = await new Promise<string>((resolve, reject) => {
    const child = spawn(claudeBin(), args, { cwd: process.cwd(), env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), 120_000);
    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim().split("\n").pop() || `Claude exited with code ${code}`));
    });
  });

  const result = JSON.parse(out) as { is_error?: boolean; result?: string; structured_output?: AssistantResult };
  if (result.is_error || !result.structured_output) throw new Error(result.result || "Claude didn't return an email.");
  return result.structured_output;
}
