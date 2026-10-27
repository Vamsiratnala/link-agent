/**
 * Link Agent MCP server: gives Claude Code's /find-jobs and /draft-emails
 * runs direct, typed access to the app's database (plan searches, save
 * openings, record rejects, finish a run, save tailored emails).
 *
 * Structured tool arguments replace shell commands carrying JSON, which a
 * background (headless) Claude Code session isn't allowed to run.
 * Registered for this project in .mcp.json; runs over stdio.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// The database lives under the project folder, so work from there whatever
// directory the server was started in. Done before loading the app modules,
// which resolve the data folder when they load.
process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
for (const file of [".env.local", ".env"]) {
  if (fs.existsSync(file)) process.loadEnvFile(file);
}
const bridge = await import("../src/lib/bridge");

const text = (v: unknown) => ({ content: [{ type: "text" as const, text: typeof v === "string" ? v : JSON.stringify(v, null, 2) }] });

const nullableString = z.string().nullable().optional();

const Opening = z.object({
  key: z.string().describe("The post's key from the extractor, unchanged"),
  source: z.enum(["search", "feed", "manual"]).optional().describe('"feed" for home-feed posts'),
  role: z.string().describe("Role title as written in the post, without emojis or hashtags"),
  company: nullableString,
  location: nullableString.describe("City or cities, using the target locations' spelling; \"Remote\" for remote roles"),
  workMode: z.enum(["remote", "hybrid", "onsite"]).nullable().optional(),
  experience: nullableString.describe('Short phrase, e.g. "2-4 years" or "Freshers"'),
  employmentType: z.enum(["full-time", "part-time", "contract", "internship"]).nullable().optional(),
  applyEmail: nullableString.describe("The address the post says to apply to; must appear in the post"),
  emails: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional().describe("Up to 8 required skills or tools named in the post"),
  summary: z.string().optional().describe("One or two plain sentences on the role and its key requirement"),
  posterName: nullableString,
  posterHeadline: nullableString,
  posterUrl: nullableString,
  postedAge: nullableString.describe('LinkedIn\'s age label, e.g. "5h" or "3d • Edited"'),
  text: z.string().describe("The full post text: the extractor's bodyParts joined, unchanged"),
  extractedBy: z.enum(["claude", "rules"]).optional(),
  draftSubject: nullableString.describe("Tailored application email subject"),
  draftBody: nullableString.describe("Tailored application email body"),
});

const server = new McpServer({ name: "link-agent", version: "1.0.0" });

server.registerTool(
  "plan",
  {
    title: "Plan a search run",
    description:
      "Start a /find-jobs run: returns the LinkedIn searches to open now (continuing the role × city rotation), the user's targets, skills, contact details, resume path, limits, and keys of posts already judged.",
  },
  async () => text(bridge.plan()),
);

server.registerTool(
  "add_openings",
  {
    title: "Save openings",
    description:
      "Save job openings judged worth applying to. Duplicates and previously rejected posts are skipped; each email is checked against the post text. Returns a result per opening.",
    inputSchema: { openings: z.array(Opening) },
  },
  async ({ openings }) => text(bridge.addOpenings(openings)),
);

server.registerTool(
  "reject_posts",
  {
    title: "Record rejected posts",
    description: "Remember posts that aren't a fit (with a short reason) so later runs skip them.",
    inputSchema: { posts: z.array(z.object({ key: z.string(), reason: z.string() })) },
  },
  async ({ posts }) => text(bridge.rejectPosts(posts)),
);

server.registerTool(
  "finish_run",
  {
    title: "Finish the run",
    description: "Log the run and email the user a digest of new openings. Call once, at the end of every /find-jobs run, including stopped ones.",
    inputSchema: {
      searches: z.number().int().describe("LinkedIn pages opened"),
      seen: z.number().int().describe("Posts judged"),
      added: z.number().int().describe("Openings saved"),
      note: z.string().optional().describe('E.g. "stopped: LinkedIn check"'),
    },
  },
  async (r) => text(await bridge.finishRun(r)),
);

server.registerTool(
  "openings_needing_drafts",
  {
    title: "Openings needing an email",
    description:
      "List openings that still use the general email template, with the post text and the user's details and resume path. Pass all=true to include every opening not yet applied to, or ids to pick some.",
    inputSchema: { all: z.boolean().optional(), ids: z.array(z.number().int()).optional() },
  },
  async (opts) => text(bridge.openingsNeedingDrafts(opts)),
);

server.registerTool(
  "save_drafts",
  {
    title: "Save tailored emails",
    description: "Save a tailored application email for each opening. Returns the [bracketed] gaps the user must fill in before sending.",
    inputSchema: { drafts: z.array(z.object({ id: z.number().int(), subject: z.string(), body: z.string() })) },
  },
  async ({ drafts }) => text(bridge.saveDrafts(drafts)),
);

await server.connect(new StdioServerTransport());
