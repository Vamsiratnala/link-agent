export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const units: [number, string][] = [
    [60, "m"],
    [3600, "h"],
    [86400, "d"],
    [604800, "w"],
    [2592000, "mo"],
    [31536000, "y"],
  ];
  let label = "m";
  let size = 60;
  for (const [sec, unit] of units) {
    if (s >= sec) {
      size = sec;
      label = unit;
    }
  }
  return `${Math.floor(s / size)}${label} ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

const MODE_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };
export const modeLabel = (m: string | null) => (m ? (MODE_LABEL[m] ?? m) : null);

export function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}
