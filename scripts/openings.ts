/**
 * Link Agent's data commands, for running by hand. Agents use the same
 * operations through the MCP server (scripts/mcp-server.ts).
 *
 *   npm run -s openings -- plan                  searches to run now + posts to skip
 *   npm run -s openings -- add     < posts.json  save openings  [{key, role, …, text}]
 *   npm run -s openings -- reject  < keys.json   remember posts that aren't a fit  [{key, reason}]
 *   npm run -s openings -- finish --searches 8 --seen 23 --new 4 [--note "…"]
 *   npm run -s openings -- digest                email yourself any openings not yet sent
 *   npm run -s openings -- drafts [--all] [--ids 3,5]   openings that need a tailored email
 *   npm run -s openings -- draft   < drafts.json save tailored emails  [{id, subject, body}]
 */
import fs from "node:fs";
import { addOpenings, digest, finishRun, openingsNeedingDrafts, plan, rejectPosts, saveDrafts } from "../src/lib/bridge";

for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}

function readStdinJson<T>(): T {
  const raw = fs.readFileSync(0, "utf8").trim();
  if (!raw) return [] as T;
  return JSON.parse(raw) as T;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const print = (v: unknown) => console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));

async function main() {
  switch (process.argv[2]) {
    case "plan":
      return print(plan());
    case "add":
      return print(addOpenings(readStdinJson<unknown[]>()));
    case "reject":
      return print(rejectPosts(readStdinJson<{ key: string; reason?: string }[]>()));
    case "finish":
      return print(
        await finishRun({
          searches: Number(arg("searches") ?? 0),
          seen: Number(arg("seen") ?? 0),
          added: Number(arg("new") ?? 0),
          note: arg("note") ?? null,
        }),
      );
    case "digest":
      return print(await digest());
    case "drafts":
      return print(
        openingsNeedingDrafts({
          all: process.argv.includes("--all"),
          ids: arg("ids")?.split(",").map(Number).filter(Boolean),
        }),
      );
    case "draft":
      return print(saveDrafts(readStdinJson<{ id: number; subject: string; body: string }[]>()));
    default:
      console.error("Usage: npm run -s openings -- <plan|add|reject|finish|digest|drafts|draft>");
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
