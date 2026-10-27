import { SettingsForm } from "@/components/SettingsForm";
import { TestEmailButton } from "@/components/TestEmailButton";
import { mailConfigured } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const settings = getSettings();
  const resumeName = settings.profile.resumeFile?.replace(/^\d+-/, "") ?? null;
  const ready = mailConfigured();

  return (
    <div className="max-w-3xl">
      <h1 className="text-title-2 sm:text-title-1">Settings</h1>
      <p className="mt-2 text-body text-fg-2">What to search for, and how your applications look.</p>

      <section className="mt-10 rounded-[24px] bg-surface p-5 sm:p-6">
        <h2 className="text-feature">Email connection</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className={`chip ${ready ? "bg-positive-bg text-positive" : "bg-warning-bg text-fg"}`}>
            {ready ? `Connected as ${process.env.SMTP_USER}` : "Not set up"}
          </span>
          {ready && <TestEmailButton />}
        </div>
        {!ready && (
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-compact text-fg-2">
            <li>Turn on 2-Step Verification for your Google account.</li>
            <li>
              Create an App Password at{" "}
              <a className="font-semibold text-fg underline underline-offset-2" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
                myaccount.google.com/apppasswords
              </a>
              .
            </li>
            <li>
              In this project&apos;s folder, create <code>.env.local</code> with <code>SMTP_USER=you@gmail.com</code> and{" "}
              <code>SMTP_PASS=the-16-letter-password</code>, then restart the app.
            </li>
          </ol>
        )}
      </section>

      <SettingsForm settings={settings} resumeName={resumeName} />
    </div>
  );
}
