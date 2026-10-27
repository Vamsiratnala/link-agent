import type { Settings } from "../settings";

type Fields = {
  role: string;
  location: string | null;
  workMode: string | null;
  summary: string;
  skills: string[];
  applyEmail: string | null;
};

function contains(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter((w) => w.length > 1);

/** Which of the user's target roles this opening belongs to, if any. */
export function matchRole(role: string, text: string, roles: string[]): string | null {
  const byLength = [...roles].sort((a, b) => b.length - a.length);
  // Expand abbreviations so "ML Engineer" ~ "Machine Learning Engineer".
  const expanded = role
    .replace(/\bml\b/gi, "machine learning")
    .replace(/\bgen ?ai\b/gi, "generative ai")
    .replace(/\bcv\b/gi, "computer vision")
    .replace(/\bds\b/gi, "data scientist");
  // Whole words, longest role first, so "GenAI Engineer" isn't read as "AI Engineer".
  const asWords = (s: string) => ` ${words(s).join(" ")} `;
  const inTitle = byLength.find((r) => asWords(expanded).includes(asWords(r)));
  if (inTitle) return inTitle;
  const titleWords = new Set(words(expanded));
  let best: { role: string; hits: number } | null = null;
  for (const r of roles) {
    const rw = words(r);
    const hits = rw.filter((w) => titleWords.has(w)).length;
    // Require most of the target role's words, so "Data Engineer" doesn't match "Data Scientist".
    if (hits >= Math.ceil(rw.length * 0.66) && (!best || hits > best.hits)) best = { role: r, hits };
  }
  if (best) return best.role;
  return byLength.find((r) => contains(text, r)) ?? null;
}

/**
 * 0–100: how well an opening fits the user. Target role 40, location 20,
 * an email to apply to 20, and 5 per matching skill up to 20.
 */
export function scoreOpening(
  job: Fields,
  matchedRole: string | null,
  search: Settings["search"],
  matchedSkills: string[] = [],
): number {
  let score = 0;
  if (matchedRole) score += 40;
  const where = `${job.location ?? ""} ${job.workMode ?? ""}`;
  if (search.locations.some((l) => contains(where, l))) score += 20;
  if (job.applyEmail) score += 20;
  score += Math.min(20, matchedSkills.length * 5);
  return Math.min(100, score);
}

/** "3d" / "5h" / "2w" / "1mo" (LinkedIn's post age) → ISO date, relative to `now`. */
export function postedAtFromAge(label: string | null | undefined, now = new Date()): string | null {
  const m = label?.match(/(\d+)\s*(mo|yr|s|m|h|d|w)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const unitMs: Record<string, number> = {
    s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5, mo: 2592e6, yr: 31536e6,
  };
  return new Date(now.getTime() - n * unitMs[m[2]]).toISOString();
}

/** A LinkedIn search that finds this exact post again from its opening words. */
export function postSearchUrl(text: string): string {
  const phrase = text
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 9)
    .join(" ");
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`"${phrase}"`)}`;
}
