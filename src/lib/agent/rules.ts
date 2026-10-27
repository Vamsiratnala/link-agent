import { companyFromEmail, extractEmails, pickApplyEmail } from "./emails";
import type { Extraction } from "./types";

const HIRING_RE =
  /\b(we(?:'re| are) hiring|hiring|#hiring|we(?:'re| are) looking for|looking for (?:an? )?(?:talented|skilled|experienced)?|job opening|openings?|vacanc(?:y|ies)|join our team|immediate joiners?|walk-?in|(?:send|share|drop|mail) (?:your |us your )?(?:updated )?(?:resume|cv))/i;

const SEEKER_RE =
  /(#opentowork|open to work|i(?:'m| am) (?:actively )?(?:looking|searching) for (?:a |an |new )?(?:job|role|opportunit|position)|seeking (?:new |a )?(?:job|role|opportunit|position)|please help me (?:find|get))/i;

const WORK_MODE: [RegExp, Extraction["workMode"]][] = [
  [/\b(remote|work from home|wfh)\b/i, "remote"],
  [/\bhybrid\b/i, "hybrid"],
  [/\b(on-?site|work from office|wfo|in-office)\b/i, "onsite"],
];

const EMPLOYMENT: [RegExp, Extraction["employmentType"]][] = [
  [/\bintern(ship)?s?\b/i, "internship"],
  [/\b(contract|c2h|freelance)\b/i, "contract"],
  [/\bpart[- ]time\b/i, "part-time"],
  [/\bfull[- ]time\b/i, "full-time"],
];

function firstMatch<T>(text: string, table: [RegExp, T][]): T | null {
  for (const [re, value] of table) if (re.test(text)) return value;
  return null;
}

function findConfigured(text: string, options: string[]): string | null {
  const lower = text.toLowerCase();
  // Longest first so "Senior React Developer" beats "React Developer".
  for (const opt of [...options].sort((a, b) => b.length - a.length)) {
    if (opt && lower.includes(opt.toLowerCase())) return opt;
  }
  return null;
}

function tidy(s: string | undefined | null, max = 80): string | null {
  if (!s) return null;
  const out = s.replace(/[*_#|•]+/g, " ").replace(/\s+/g, " ").trim().replace(/[\s,.:;–—-]+$/, "");
  return out.length >= 2 ? out.slice(0, max) : null;
}

/**
 * Free, offline reading of a post. Good enough to find emails and
 * filter out job seekers; Claude does much better on role/company.
 */
export function extractWithRules(text: string, roles: string[], locations: string[]): Extraction {
  const emails = extractEmails(text);
  const applyEmail = pickApplyEmail(emails, text);
  const isSeeker = SEEKER_RE.test(text) && !/we(?:'re| are) hiring/i.test(text);
  const isHiring = !isSeeker && (HIRING_RE.test(text) || (emails.length > 0 && /\b(role|position|opening)\b/i.test(text)));

  const role =
    tidy(text.match(/(?:hiring|looking for|opening for|position|role)\s*(?:for|:|-|–)?\s*(?:an?\s+)?(?:a\s+)?([A-Z][\w+#./&() -]{2,60}?)(?=\s*(?:\(|–|—|-\s|\||,|\n|!|\.\s|$|\bat\b|\bin\b|\bwith\b|\bto\b))/)?.[1]) ??
    findConfigured(text, roles) ??
    tidy(text.split("\n").find((l) => l.trim().length > 8), 70) ??
    "Untitled role";

  const location =
    findConfigured(text, locations.filter((l) => l.toLowerCase() !== "remote")) ??
    tidy(text.match(/\b(?:location|based in|loc|job location)\s*[:\-–]?\s*([^\n|•,]{2,50})/i)?.[1], 50);

  const company =
    tidy(text.match(/\b(?:company|organi[sz]ation|client)\s*[:\-–]\s*([^\n|•]{2,50})/i)?.[1], 50) ??
    tidy(text.match(/\b(?:at|@)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})(?=\s*(?:,|\.|!|\n|is\b|are\b|we\b|-|–|\|))/)?.[1], 50) ??
    companyFromEmail(applyEmail);

  const experience = tidy(
    text.match(/(\d+(?:\.\d+)?\s*(?:\+|-|–|to)?\s*\d*\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+experience)?)/i)?.[1] ??
      text.match(/\b(freshers?(?: can apply)?|entry[- ]level)\b/i)?.[1],
    40,
  );

  const summary = text.replace(/\s+/g, " ").trim().slice(0, 280);

  return {
    isHiring,
    role,
    company,
    location,
    workMode: firstMatch(text, WORK_MODE),
    experience,
    employmentType: firstMatch(text, EMPLOYMENT),
    applyEmail,
    emails,
    skills: [],
    summary,
    extractedBy: "rules",
  };
}
