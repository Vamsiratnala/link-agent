---
description: Write a tailored application email for each Link Agent opening, from the job post and your resume
argument-hint: "[--all | --ids 3,5]"
allowed-tools: Read, mcp__link-agent__openings_needing_drafts, mcp__link-agent__save_drafts
---

Write an application email for each opening that still uses the general template, tailored to that job post and to the user's resume. Nothing is sent: the drafts appear on each job page, where the user reviews and sends them.

## Steps

1. Call the Link Agent MCP tool `openings_needing_drafts`. Arguments given to this command: `$ARGUMENTS`. With none, call it with no arguments (openings without a tailored draft); for `--all` pass `all: true` (every opening not yet applied to); for `--ids 3,5` pass `ids: [3, 5]`. It returns `you` (name, contact details, skills, `resumePath`) and `openings`.
2. If `openings` is empty, say so in one line and stop.
3. Read the resume at `you.resumePath` once. It is the only source for claims about the user's experience.
4. Write one email per opening, following **How to write the email** below.
5. Save them with the `save_drafts` tool: `drafts: [{"id": 3, "subject": "…", "body": "…"}]`. Each result lists `toFillIn`, the gaps the user must complete.
6. Reply with one line per opening: role · company · what the email leads with · anything the user must fill in.

## How to write the email

**Follow the post's instructions first.** Use the exact subject line a post asks for ("Subject line: Data Engineer" means the subject is `Data Engineer`, or the format it gives). Answer every question the post says to answer, in its order, under a short heading or numbered list. When a post says to mention something (notice period, current location, experience), include it.

**Never invent facts.** Every claim about the user comes from the resume or the `you` details. When the post asks for something the resume doesn't contain (notice period, current or expected CTC, availability date, current city), write a bracketed gap such as `[notice period]` or `[current CTC] / [expected CTC]`. The app won't send until the user replaces every bracketed gap. Don't claim skills, domains or tools the resume doesn't show; if the post's must-have is something the user lacks (for example credit-risk experience), say briefly and honestly what related experience they do have.

**Make it about this job.**
- Greeting: `Hi <first name>,` when the poster is a person, otherwise `Hi <company> team,` or `Hi Hiring Team,`.
- Opening line: the exact role and company as the post names them, and where it was seen ("your LinkedIn post").
- Middle: pick the two or three resume achievements that best match the post's required skills, with their real numbers, and connect each to what the role does. Don't list everything; a computer-vision role leads with the vision work, an LLM/RAG role leads with the RAG and fine-tuning work.
- One sentence on education only if the post asks about it or is aimed at recent graduates.
- Close: resume attached, available to talk.
- Sign-off: `Best regards,` then name, phone, email and LinkedIn URL from `you`, each on its own line.

**Style.** 120–200 words before the sign-off, plain text, short paragraphs, no emojis, no hashtags, no buzzwords ("passionate", "synergy"). Write as the user, in first person. If no subject line is required, use `Application for <role> – <name>`.
