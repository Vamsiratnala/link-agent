# Link Agent

Finds job openings in LinkedIn posts, pulls out the email to apply to, and lets you apply by email from your own Gmail. No LinkedIn Easy Apply, no paid APIs: the agent is Claude Code (included in Claude Pro) reading LinkedIn in your own logged-in Chrome.

```
Claude Code  /find-jobs                          Web app  (localhost:3000)
  plan  ──►  LinkedIn post search in your Chrome   Openings ─► Job page ─► Apply panel ─► your Gmail
             (read-only, extractor script)            ▲                                     │
  judge each post (hiring? your role? email?)         │                                     ▼
  save ──►  scripts/openings.ts ──► SQLite (data/) ───┘             digest email      recruiter
```

## Setup (once)

1. `npm install`
2. Gmail, so the app can send for you: turn on 2-Step Verification, create an [App Password](https://myaccount.google.com/apppasswords), then `cp .env.example .env.local` and fill in `SMTP_USER` and `SMTP_PASS`.
3. `npm run build && npm start` (or `npm run dev`), open http://localhost:3000/settings, and fill in your details, resume, roles and locations. **Send test email** confirms Gmail works.
4. In Chrome: stay logged in to LinkedIn, with the Claude in Chrome extension connected.

## Finding jobs

Click **Get jobs** on the Openings page. The app starts Claude Code in the background (`claude -p "/find-jobs" --chrome`), which searches LinkedIn in your Chrome, saves the openings that fit with an email written for each, and emails you a digest. The button shows progress, can stop the run, and refreshes the list when it finishes. Chrome must be open with the Claude extension connected.

Or, in Claude Code opened in this folder:

- `/find-jobs` runs one search round: about 8 LinkedIn post searches (role × location, continuing where the last run stopped) plus your home feed, at most 40 posts. Claude keeps real hiring posts for your roles that include an email, saves them, and emails you a digest.
- `/loop 3h /find-jobs` repeats it every 3 hours while the session stays open, your laptop is awake and Chrome is running.

The app doesn't need to be running during a search; the agent writes straight to the database.

## Applying

Each opening comes with an email written for that job: it follows the post's own instructions (required subject line, questions to answer) and leads with the parts of your resume that match. Facts your resume doesn't hold, like notice period or CTC, are left as `[bracketed gaps]`, and the app won't send until you fill them. Run `/draft-emails` to write drafts for openings that don't have one (posts you pasted), or `/draft-emails --all` after updating your resume.

Open an opening, read the post and the email, and adjust it with the **Email assistant** below the message: one-click Simplify, Elaborate, Shorter, More formal, Friendlier or Match the post, or ask in your own words ("lead with my edge deployment work"). It knows your resume (Settings → Resume text), the post and the email, won't add claims your resume doesn't support, and every change can be undone. Your edits are saved automatically. Fill any gaps and click **Send application**. It goes from your Gmail with your resume attached. At most 25 go out in any 24 hours (`DAILY_SEND_LIMIT`). **Open in Gmail instead** opens a draft in Gmail without the attachment.

Spotted a post yourself? Paste it on **Add a post**.

## How it's put together

Full architecture, where MCP is used (Claude in Chrome for the browser, and this project's own `link-agent` MCP server for the database), and the technology stack: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Path | What it is |
| --- | --- |
| `.claude/commands/find-jobs.md` | The agent's instructions: which pages to open, what to keep, the format to save |
| `agent/linkedin-extract.js` | Read-only script Claude runs in the LinkedIn tab: scrolls, expands "…more", returns posts as JSON |
| `scripts/openings.ts` | `plan` / `add` / `reject` / `finish` / `digest`: the bridge from Claude Code to the database |
| `src/lib/` | Database (`node:sqlite`), settings, email finder and rules, scoring, Gmail sending |
| `src/app/` | Next.js pages: Openings, Job, Applications, Add a post, Settings |
| `data/` | Your database and resume (git-ignored) |

`npm test` runs the unit tests (email extraction, role matching, templates).

## LinkedIn account safety

LinkedIn's User Agreement prohibits automated access, and `/find-jobs` automates your own account. It reduces the risk by only reading (never liking, messaging, connecting or applying), pausing between pages, capping each run, and stopping at once if LinkedIn shows a security check. Lower **Searches per run** and **Posts read per run** in Settings to be more cautious.
