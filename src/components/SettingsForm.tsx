"use client";

import { useActionState } from "react";
import { saveSettingsAction, type ActionState } from "@/app/actions";
import type { Settings } from "@/lib/settings";
import { TagInput } from "./TagInput";

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="text-feature">{title}</h2>
      {hint && <p className="mt-1 text-compact text-fg-2">{hint}</p>}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  );
}

function Toggle({ name, defaultChecked, label, hint }: { name: string; defaultChecked: boolean; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="relative mt-0.5 h-6 w-10 shrink-0 rounded-full bg-surface-strong transition peer-checked:bg-inverse after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-bg after:shadow after:transition peer-checked:after:translate-x-4" />
      <span>
        <span className="block text-compact font-semibold">{label}</span>
        <span className="block text-caption text-fg-2">{hint}</span>
      </span>
    </label>
  );
}

export function SettingsForm({ settings: s, resumeName }: { settings: Settings; resumeName: string | null }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveSettingsAction, null);

  return (
    <form action={action} className="mt-10 space-y-10">
      <Section title="Your details" hint="Used to fill in your application emails.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="fullName">Full name</label><input id="fullName" name="fullName" className="field" defaultValue={s.profile.fullName} /></div>
          <div><label className="label" htmlFor="email">Email for replies</label><input id="email" name="email" type="email" className="field" defaultValue={s.profile.email} /></div>
          <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" className="field" defaultValue={s.profile.phone} /></div>
          <div><label className="label" htmlFor="linkedinUrl">LinkedIn profile URL</label><input id="linkedinUrl" name="linkedinUrl" className="field" defaultValue={s.profile.linkedinUrl} /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="portfolioUrl">Portfolio or GitHub</label><input id="portfolioUrl" name="portfolioUrl" className="field" defaultValue={s.profile.portfolioUrl} /></div>
        </div>
        <div>
          <label className="label" htmlFor="resume">Resume</label>
          <input id="resume" name="resume" type="file" accept=".pdf,.doc,.docx" className="field file:mr-3 file:rounded-full file:border-0 file:bg-inverse file:px-3 file:py-1 file:text-caption file:font-semibold file:text-on-inverse" />
          <p className="mt-1.5 text-caption text-fg-2">{resumeName ? `Current: ${resumeName}. Choose a file to replace it.` : "PDF or Word, under 8 MB. Attached to every application."}</p>
        </div>
        <div>
          <label className="label">Your skills</label>
          <TagInput name="skills" initial={s.profile.skills} placeholder="e.g. Computer Vision, PyTorch" />
          <p className="mt-1.5 text-caption text-fg-2">Openings that ask for these rank higher, and each job page shows which ones match.</p>
        </div>
        <div>
          <label className="label" htmlFor="resumeText">Resume text</label>
          <textarea id="resumeText" name="resumeText" rows={10} className="field resize-y font-mono text-caption leading-5" defaultValue={s.profile.resumeText} placeholder="Paste your resume as plain text" />
          <p className="mt-1.5 text-caption text-fg-2">What the email assistant knows about you. Update it when you upload a new resume; if it's empty, the assistant reads the PDF instead (slower).</p>
        </div>
      </Section>

      <Section title="What to search for" hint="Each run of /find-jobs searches LinkedIn posts for role × location, continuing where the last run stopped.">
        <div><label className="label">Roles</label><TagInput name="roles" initial={s.search.roles} placeholder="e.g. Machine Learning Engineer" /></div>
        <div><label className="label">Locations</label><TagInput name="locations" initial={s.search.locations} placeholder="e.g. Bengaluru, Remote" /></div>
        <div><label className="label">Extra keywords (optional)</label><TagInput name="keywords" initial={s.search.keywords} placeholder="e.g. python, LLM" /></div>
        <div><label className="label">Skip posts containing</label><TagInput name="excludeKeywords" initial={s.search.excludeKeywords} placeholder="e.g. unpaid" /></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label" htmlFor="recency">Posts from the</label>
            <select id="recency" name="recency" className="field" defaultValue={s.search.recency}>
              <option value="past-24h">Past 24 hours</option>
              <option value="past-week">Past week</option>
              <option value="past-month">Past month</option>
            </select>
          </div>
          <div><label className="label" htmlFor="maxSearchesPerRun">Searches per run</label><input id="maxSearchesPerRun" name="maxSearchesPerRun" type="number" min={1} max={20} className="field" defaultValue={s.search.maxSearchesPerRun} /></div>
          <div><label className="label" htmlFor="maxPostsPerRun">Posts read per run</label><input id="maxPostsPerRun" name="maxPostsPerRun" type="number" min={5} max={100} className="field" defaultValue={s.search.maxPostsPerRun} /></div>
        </div>
        <div className="sm:w-1/3">
          <label className="label" htmlFor="maxYearsExperience">Max years of experience asked for</label>
          <input id="maxYearsExperience" name="maxYearsExperience" type="number" min={0} max={30} className="field" defaultValue={s.search.maxYearsExperience ?? ""} placeholder="Any" />
          <p className="mt-1.5 text-caption text-fg-2">Skips posts like &ldquo;8+ years&rdquo; when set to 2. Posts that don&apos;t say are kept.</p>
        </div>
        <p className="text-caption text-fg-2">Fewer searches and posts per run means less activity on your LinkedIn account and less of your Claude usage.</p>
        <Toggle name="scanFeed" defaultChecked={s.search.scanFeed} label="Also read my home feed" hint="Posts LinkedIn already shows you, after the searches." />
        <Toggle name="includeNoEmail" defaultChecked={s.search.includeNoEmail} label="Keep posts without an email" hint="Saves hiring posts that say “DM me” or link to a form." />
      </Section>

      <Section title="Application email" hint="Placeholders: {{role}} {{company}} {{location}} {{name}} {{email}} {{phone}} {{linkedin}} {{portfolio}} {{greeting_name}}. A line holding only a blank placeholder is left out.">
        <div><label className="label" htmlFor="subject">Subject</label><input id="subject" name="subject" className="field" defaultValue={s.template.subject} /></div>
        <div><label className="label" htmlFor="body">Message</label><textarea id="body" name="body" rows={12} className="field resize-y leading-6" defaultValue={s.template.body} /></div>
      </Section>

      <Section title="Digest">
        <Toggle name="digestEnabled" defaultChecked={s.notify.digestEnabled} label="Email me new openings after each run" hint="One email listing what /find-jobs found." />
        <div><label className="label" htmlFor="digestTo">Send the digest to</label><input id="digestTo" name="digestTo" type="email" className="field" defaultValue={s.notify.digestTo} placeholder="Defaults to your email above" /></div>
      </Section>

      <div className="sticky bottom-4 flex items-center gap-3 rounded-full bg-bg/90 py-2 backdrop-blur">
        <button className="btn-primary" disabled={pending}>{pending ? "Saving…" : "Save settings"}</button>
        {state && <span className={`text-compact ${state.ok ? "text-positive" : "text-negative"}`}>{state.message}</span>}
      </div>
    </form>
  );
}
