import { kvGet, kvSet } from "./db";

export type Recency = "past-24h" | "past-week" | "past-month";

export type Settings = {
  profile: {
    fullName: string;
    email: string;
    phone: string;
    linkedinUrl: string;
    portfolioUrl: string;
    resumeFile: string | null;
    /** Used to rank openings and show which of your skills a post asks for. */
    skills: string[];
    /** Your resume as plain text, for the email assistant. */
    resumeText: string;
  };
  search: {
    roles: string[];
    locations: string[];
    /** Extra words added to every LinkedIn search, e.g. "python". */
    keywords: string[];
    /** Posts containing any of these are skipped. */
    excludeKeywords: string[];
    recency: Recency;
    maxSearchesPerRun: number;
    maxPostsPerRun: number;
    scanFeed: boolean;
    /** Keep hiring posts that have no email (they say "DM me" or link a form). */
    includeNoEmail: boolean;
    /** Skip posts asking for more years than this. Null keeps every level. */
    maxYearsExperience: number | null;
  };
  notify: {
    digestEnabled: boolean;
    digestTo: string;
  };
  template: {
    subject: string;
    body: string;
  };
};

export const DEFAULT_SETTINGS: Settings = {
  profile: {
    fullName: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    portfolioUrl: "",
    resumeFile: null,
    skills: [],
    resumeText: "",
  },
  search: {
    // Matched to your resume (computer vision + VLM work) and preferred cities.
    roles: ["Computer Vision Engineer", "AI Engineer", "Machine Learning Engineer", "Generative AI Engineer", "Data Scientist"],
    locations: ["Hyderabad", "Mumbai"],
    keywords: [],
    excludeKeywords: ["unpaid", "commission only"],
    recency: "past-week",
    maxSearchesPerRun: 8,
    maxPostsPerRun: 40,
    scanFeed: true,
    includeNoEmail: false,
    maxYearsExperience: null,
  },
  notify: {
    digestEnabled: true,
    digestTo: "",
  },
  template: {
    subject: "Application for {{role}} – {{name}}",
    body: `Hi {{greeting_name}},

I came across your LinkedIn post about the {{role}} opening at {{company}} and I'd like to be considered for it.

I've attached my resume. I'd be glad to share more about my experience or set up a quick call at your convenience.

Thank you for your time.

Best regards,
{{name}}
{{phone}}
{{linkedin}}`,
  },
};

export function getSettings(): Settings {
  const raw = kvGet("settings");
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  const saved = JSON.parse(raw) as Partial<Settings>;
  // Merge section by section so settings saved by an older version
  // pick up any fields added later.
  return {
    profile: { ...DEFAULT_SETTINGS.profile, ...saved.profile },
    search: { ...DEFAULT_SETTINGS.search, ...saved.search },
    notify: { ...DEFAULT_SETTINGS.notify, ...saved.notify },
    template: { ...DEFAULT_SETTINGS.template, ...saved.template },
  };
}

export function saveSettings(settings: Settings): void {
  kvSet("settings", JSON.stringify(settings));
}

export function fillTemplate(
  template: string,
  vars: Record<string, string | null | undefined>,
): string {
  const out: string[] = [];
  for (const line of template.split("\n")) {
    const filled = line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key]?.trim() ?? "");
    // A line made only of placeholders (e.g. "{{phone}}") is dropped when the
    // value is blank, so an unset phone number doesn't leave a hole in the signature.
    const placeholderOnly = /^\s*(\{\{\s*\w+\s*\}\}\s*)+$/.test(line);
    if (placeholderOnly && filled.trim() === "") continue;
    out.push(filled);
  }
  return out.join("\n").trimEnd();
}
