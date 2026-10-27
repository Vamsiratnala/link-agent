"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { unfilledPlaceholders } from "@/lib/placeholders";
import { applyAction, saveDraftAction, type ActionState } from "@/app/actions";
import { EmailAssistant } from "./EmailAssistant";
import { ClipIcon, ExternalIcon } from "./icons";

type Props = {
  jobId: number;
  emails: string[];
  defaultTo: string;
  defaultSubject: string;
  defaultBody: string;
  resumeName: string | null;
  mailReady: boolean;
  dailyLimit: number;
  alreadySent: boolean;
  /** True when the email was written for this opening rather than taken from the general template. */
  tailored: boolean;
};

export function ApplyPanel(p: Props) {
  const [state, action, pending] = useActionState<ActionState, FormData>(applyAction, null);
  const [to, setTo] = useState(p.defaultTo);
  const [subject, setSubject] = useState(p.defaultSubject);
  const [body, setBody] = useState(p.defaultBody);
  const gaps = unfilledPlaceholders(`${subject}\n${body}`);

  const gmailUrl =
    "https://mail.google.com/mail/?view=cm&fs=1" +
    `&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="jobId" value={p.jobId} />

      {p.tailored ? (
        <p className="rounded-xl bg-positive-bg px-3.5 py-2.5 text-compact text-positive">
          Written for this opening from the post and your resume. Read it through before sending.
        </p>
      ) : (
        <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-compact">
          This is your general template. For an email written for this job, run <code>/draft-emails</code> in Claude Code.
        </p>
      )}

      <div>
        <label className="label" htmlFor="to">To</label>
        {p.emails.length > 1 ? (
          <select id="to" name="to" className="field" value={to} onChange={(e) => setTo(e.target.value)}>
            {p.emails.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        ) : (
          <input id="to" name="to" className="field" value={to} readOnly />
        )}
      </div>

      <div>
        <label className="label" htmlFor="subject">Subject</label>
        <input id="subject" name="subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => saveDraftAction(p.jobId, subject, body)} />
      </div>

      <div>
        <label className="label" htmlFor="body">Message</label>
        <textarea id="body" name="body" rows={16} className="field resize-y leading-6" value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => saveDraftAction(p.jobId, subject, body)} />
      </div>

      <EmailAssistant
        jobId={p.jobId}
        subject={subject}
        body={body}
        onRewrite={(next) => {
          setSubject(next.subject);
          setBody(next.body);
          saveDraftAction(p.jobId, next.subject, next.body);
        }}
      />

      <div className="flex items-center gap-2 text-compact">
        <ClipIcon className="size-4 text-fg-2" />
        {p.resumeName ? (
          <span className="truncate">{p.resumeName}</span>
        ) : (
          <span className="text-fg-2">
            No resume attached.{" "}
            <Link href="/settings" className="font-semibold text-fg underline underline-offset-2">Upload one</Link>
          </span>
        )}
      </div>

      {gaps.length > 0 && (
        <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-compact">
          Fill in before sending: {gaps.join(", ")}
        </p>
      )}

      {state && (
        <p className={`rounded-xl px-3.5 py-2.5 text-compact ${state.ok ? "bg-positive-bg text-positive" : "bg-negative-bg text-negative"}`}>
          {state.message}
        </p>
      )}

      {p.mailReady ? (
        <button className="btn-primary w-full" disabled={pending || gaps.length > 0}>
          {pending ? "Sending…" : p.alreadySent ? "Send again" : "Send application"}
        </button>
      ) : (
        <p className="rounded-xl bg-warning-bg px-3.5 py-2.5 text-compact">
          To send from here, add your Gmail App Password to <code>.env.local</code> (see Settings). Until then, use Gmail below.
        </p>
      )}
      <a href={gmailUrl} target="_blank" rel="noreferrer" className="btn-secondary w-full">
        Open in Gmail instead <ExternalIcon />
      </a>
      <p className="text-center text-caption text-fg-3">
        Sends from your account, at most {p.dailyLimit} a day. &ldquo;Open in Gmail&rdquo; doesn&apos;t attach your resume.
      </p>
    </form>
  );
}
