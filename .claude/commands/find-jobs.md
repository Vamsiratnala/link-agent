---
description: Search LinkedIn in your Chrome for hiring posts with an email, and save them to Link Agent
allowed-tools: Read, mcp__link-agent__plan, mcp__link-agent__add_openings, mcp__link-agent__reject_posts, mcp__link-agent__finish_run, mcp__claude-in-chrome__tabs_context_mcp, mcp__claude-in-chrome__tabs_create_mcp, mcp__claude-in-chrome__tabs_close_mcp, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__computer
---

Find new job openings in LinkedIn posts using the user's own logged-in Chrome, and save the ones worth applying to into Link Agent. Work quietly; report only at the end.

Link Agent's data is reached through its MCP server (`link-agent`): `plan`, `add_openings`, `reject_posts`, `finish_run`. Pass data to them as tool arguments; don't use the shell.

## Rules for LinkedIn (the user's real account)

- Read only. Never click Like, Comment, Repost, Send, Follow, Connect, Message, Apply or Easy Apply, and never type anything into LinkedIn.
- Only open URLs that the `plan` tool gives you (`searches[].url` and `feedUrl`).
- Wait 4–8 seconds between page loads (use the `computer` tool's `wait`). Don't open individual posts or profiles.
- If the extractor returns `"blocked": true`, or a page shows a security check, CAPTCHA, login wall or a warning about automated activity: stop immediately, close your tab, call `finish_run` with `note: "stopped: LinkedIn check"`, and tell the user. Never try to get past it.

## Steps

1. Call the `plan` tool. Keep its result: target roles and locations, `you`, `yourSkills`, `resumePath`, `excludeKeywords`, `includeNoEmail`, `maxYearsExperience`, `maxPostsPerRun`, `scanFeed`, `searches`, `feedUrl`, `seenKeys`.
   Read the resume at `resumePath` and `.claude/commands/draft-emails.md` (the email-writing rules) once each.
2. Call `tabs_context_mcp` with `createIfEmpty: true`, then `tabs_create_mcp`. Do all work in that one new tab.
3. Read `agent/linkedin-extract.js` once. To run it on a page, pass its full text to `javascript_tool` with the two placeholders replaced:
   - `__SEEN__` → a JSON array of `seenKeys` plus every key you've already handled in this run
   - `__OPTS__` → `{"includeNoEmail": <from plan>, "scrolls": 3}`
   It returns `{blocked, postsOnPage, returned, posts: [{key, poster, headline, profile, age, emails, bodyParts}]}`. A post's full text is `bodyParts` joined with no separator (the browser tool cuts long strings, so the text is split).
4. For each search in `searches` (in order), then the feed if `scanFeed` is true: navigate, wait, run the extractor, and judge each returned post (next section). Stop early once you've judged `maxPostsPerRun` posts.
5. After every two pages, save what you have:
   - Openings: `add_openings` with `openings`: an array of opening objects (format below).
   - Rejected posts: `reject_posts` with `posts`: `[{"key": "…", "reason": "short reason"}]`, so later runs skip them.
   If `add_openings` reports an item as `invalid`, fix that item and send it again once.
6. When done: `finish_run` with `searches` (pages opened), `seen` (posts judged) and `added` (openings saved). This logs the run and emails the user a digest. Call it even if the run stopped early.
7. Close your tab with `tabs_close_mcp`.
8. Reply in two or three lines: how many posts you read, how many openings you saved (list role · company · email for each, at most 10), and anything that went wrong.

## Which posts to keep

Keep a post when all of these hold:

- It advertises an open position someone can apply to now. Reject people looking for work (#opentowork, "I'm looking for a role"), course or bootcamp ads, paid placement offers, "how I got hired" stories, and news.
- The role is one of the target roles or a close variant, for example: "Computer Vision Engineer" also covers CV Engineer, Vision AI Engineer, Perception Engineer, Deep Learning Engineer (vision), OCR / Document AI Engineer, Edge AI Engineer; "Machine Learning Engineer" also ML Engineer, Applied Scientist, MLOps Engineer, NLP Engineer; "AI Engineer" also AI/ML Engineer; "Generative AI Engineer" also GenAI, LLM or VLM Engineer; "Data Scientist" also Junior/Associate/Applied Data Scientist. Reject unrelated roles (sales, HR, frontend, DevOps-only, data entry or annotation) even when the post mentions AI.
- Use `yourSkills` to settle borderline titles: a generic "AI/ML Developer" post asking for several of them is a fit; one built around skills the user doesn't list is not.
- The location includes one of the target locations (a post listing several cities counts if one of them is a target). Remote roles count only when "Remote" is a target. Keep posts in India that name no city. Reject everything else, including other Indian cities and other countries.
- Unless `includeNoEmail` is true, the post contains an email to apply to. Count "name [at] company [dot] com" style addresses, written back as a normal address.
- It doesn't contain any of `excludeKeywords`.
- If `maxYearsExperience` is a number, the post's minimum required experience is not above it ("8+ years" fails a limit of 2; "0-2 years", "freshers" and posts that don't say pass).

A post can list several roles. Save one opening for the best-matching target role only, describing that role.

## Opening format

One JSON object per kept post. Use only facts in the post; use `null` when the post doesn't say.

```json
{
  "key": "<the post's key, unchanged>",
  "source": "search",
  "role": "Machine Learning Engineer",
  "company": "NuPlay",
  "location": "Bengaluru",
  "workMode": "onsite",
  "experience": "3-5 years",
  "employmentType": "full-time",
  "applyEmail": "careers@nuplay.ai",
  "emails": ["careers@nuplay.ai"],
  "skills": ["ASR", "TTS", "PyTorch"],
  "summary": "One or two plain sentences: what the role is and its key requirement.",
  "posterName": "<poster>",
  "posterHeadline": "<headline>",
  "posterUrl": "<profile>",
  "postedAge": "<age>",
  "text": "<bodyParts joined, unchanged>",
  "extractedBy": "claude",
  "draftSubject": "<subject, following the post's instructions>",
  "draftBody": "<the tailored email>"
}
```

- `source` is `"feed"` for posts from the home feed.
- `role`: the title as written, cleaned of emojis and hashtags.
- `location`: the city or cities for this role, using the target locations' spelling for the same city (Bangalore → Bengaluru); `"Remote"` for remote roles.
- `company`: the hiring company. If a recruiting agency posts for an unnamed client, use the agency's name.
- `workMode`: `"remote"`, `"hybrid"`, `"onsite"` or `null`. `employmentType`: `"full-time"`, `"part-time"`, `"contract"`, `"internship"` or `null`.
- `applyEmail`: the address the post says to send applications to. It must appear in the post; never construct one from a company name.
- `skills`: up to 8 required skills or tools named in the post.
- `draftSubject` / `draftBody`: the application email for this opening, written by the rules in **How to write the email** in `.claude/commands/draft-emails.md`: the post's required subject and questions first, the resume achievements that match this job, bracketed gaps like `[notice period]` for facts the resume doesn't have, the sign-off with the user's details from the plan's `you`.
- `text` is the post's `bodyParts` joined, unchanged. The app checks emails against it and shows it on the job page.
