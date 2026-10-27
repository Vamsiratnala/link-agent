export type WorkMode = "remote" | "hybrid" | "onsite";
export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";

/** What we know about one job opening read from a LinkedIn post. */
export type Extraction = {
  isHiring: boolean;
  role: string;
  company: string | null;
  location: string | null;
  workMode: WorkMode | null;
  experience: string | null;
  employmentType: EmploymentType | null;
  applyEmail: string | null;
  emails: string[];
  skills: string[];
  summary: string;
  extractedBy: "claude" | "rules";
};
