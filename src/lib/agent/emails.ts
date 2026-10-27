const EMAIL_RE = /[a-z0-9][a-z0-9._%+-]*@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,24}/gi;

// "hr [at] acme [dot] com", "hr(at)acme(dot)com", "hr at acme dot com".
// A plain "." separator takes no spaces, so "hr@acme.ai. Questions" stops at ".ai".
const AT = String.raw`(?:\s*[[({<]\s*at\s*[\])}>]\s*|\s+at\s+|\s*@\s*)`;
const DOT = String.raw`(?:\s*[[({<]\s*dot\s*[\])}>]\s*|\s+dot\s+|\.)`;
const OBFUSCATED_RE = new RegExp(String.raw`([a-z0-9][a-z0-9._%+-]*)${AT}([a-z0-9-]+(?:${DOT}[a-z0-9-]+)+)`, "gi");
const HAS_SPELLED = /[[({<]\s*(at|dot)\s*[\])}>]|\s(at|dot)\s/i;

// Words that precede a plain " at " in normal prose ("I work at acme.com").
const PROSE_WORDS = new Set([
  "work", "works", "working", "worked", "me", "us", "him", "her", "them", "is", "was",
  "are", "am", "be", "based", "located", "team", "apply", "intern", "interning", "role",
  "opening", "openings", "hiring", "join", "joining", "position", "positions", "jobs",
  "available", "live",
]);

const BLOCKED_DOMAINS = ["example.com", "linkedin.com", "sentry.io", "email.com", "domain.com"];
const BLOCKED_LOCAL = /^(no-?reply|donotreply|mailer-daemon|postmaster)$/;
const FILE_SUFFIX = /\.(png|jpe?g|gif|webp|svg|pdf|docx?)$/;

function clean(raw: string): string | null {
  const email = raw.toLowerCase().replace(/^[._%+-]+|[._%+-]+$/g, "");
  const [local, domain] = email.split("@");
  if (!local || !domain) return null;
  if (BLOCKED_LOCAL.test(local)) return null;
  if (FILE_SUFFIX.test(email)) return null;
  if (BLOCKED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return null;
  return email;
}

/** All distinct email addresses in a post, including lightly obfuscated ones. */
export function extractEmails(text: string): string[] {
  const found = new Set<string>();

  for (const m of text.matchAll(EMAIL_RE)) {
    const email = clean(m[0]);
    if (email) found.add(email);
  }

  for (const m of text.matchAll(OBFUSCATED_RE)) {
    const [whole, local, domainRaw] = m;
    // Ordinary addresses were already found above.
    if (!HAS_SPELLED.test(whole)) continue;
    const usedPlainAt = /\s+at\s+/i.test(whole) && !/[[({<]\s*at/i.test(whole) && !whole.includes("@");
    if (usedPlainAt && PROSE_WORDS.has(local.toLowerCase())) continue;
    const domain = domainRaw.replace(/\s*(?:[[({<]\s*dot\s*[\])}>]|\s+dot\s+|\.)\s*/gi, ".");
    // A plain "at"/"dot" spelling only counts when it ends in a real-looking TLD.
    if (usedPlainAt && !/\.[a-z]{2,24}$/i.test(domain)) continue;
    const email = clean(`${local}@${domain}`);
    if (email && /\.[a-z]{2,24}$/.test(email)) found.add(email);
  }

  return [...found];
}

const APPLY_HINT = /(resume|cv|apply|applications?|send|share|mail|reach|drop|contact|dm)/i;

/** The address the post most likely wants applications sent to. */
export function pickApplyEmail(emails: string[], text: string): string | null {
  if (emails.length === 0) return null;
  const lower = text.toLowerCase();
  for (const email of emails) {
    const at = lower.indexOf(email.split("@")[0]);
    if (at === -1) continue;
    const window = lower.slice(Math.max(0, at - 80), at);
    if (APPLY_HINT.test(window)) return email;
  }
  return emails[0];
}

const PERSONAL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com",
  "live.com", "icloud.com", "proton.me", "protonmail.com", "rediffmail.com", "zoho.com",
]);

/** "careers@acme-labs.io" → "Acme Labs". Null for personal mailboxes. */
export function companyFromEmail(email: string | null): string | null {
  if (!email) return null;
  const domain = email.split("@")[1];
  if (!domain || PERSONAL_DOMAINS.has(domain)) return null;
  const label = domain.split(".")[0];
  return label
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
