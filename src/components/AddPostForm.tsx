"use client";

import { useActionState } from "react";
import { addPostAction, type ActionState } from "@/app/actions";

export function AddPostForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(addPostAction, null);
  return (
    <form action={action} className="mt-8 space-y-5">
      <div>
        <label className="label" htmlFor="text">Post text</label>
        <textarea id="text" name="text" rows={12} required className="field resize-y leading-6" placeholder="We're hiring a Machine Learning Engineer in Bengaluru… send your resume to hr@company.com" />
      </div>

      <details className="rounded-[20px] border border-line p-4">
        <summary className="cursor-pointer text-compact font-semibold">Correct the details (optional)</summary>
        <p className="mt-2 text-caption text-fg-2">Leave blank to use what the app reads from the post.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {[
            ["role", "Role"],
            ["company", "Company"],
            ["location", "Location"],
            ["applyEmail", "Email to apply to"],
          ].map(([name, label]) => (
            <div key={name}>
              <label className="label" htmlFor={name}>{label}</label>
              <input id={name} name={name} className="field" />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="postUrl">Link to the post</label>
            <input id="postUrl" name="postUrl" type="url" className="field" placeholder="https://www.linkedin.com/posts/…" />
          </div>
        </div>
      </details>

      {state && !state.ok && <p className="rounded-xl bg-negative-bg px-3.5 py-2.5 text-compact text-negative">{state.message}</p>}
      <button className="btn-primary" disabled={pending}>{pending ? "Adding…" : "Add to openings"}</button>
    </form>
  );
}
