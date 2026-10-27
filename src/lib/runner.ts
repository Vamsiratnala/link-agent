import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DATA_DIR, db, kvGet, kvSet } from "./db";
import { lastRun } from "./jobs";
import { getSettings } from "./settings";

/**
 * Runs /find-jobs in a background, headless Claude Code session so the web
 * app's "Get jobs" button does the same thing as typing the command.
 * The session uses your Claude Code login (Pro plan) and your Chrome.
 */

const RUN_DIR = path.join(DATA_DIR, "runs");

// Exactly what /find-jobs is allowed to use; anything else (including the
// shell) is refused in headless mode. Data goes through the Link Agent MCP server.
const ALLOWED_TOOLS = [
  "Read",
  "mcp__link-agent__plan",
  "mcp__link-agent__add_openings",
  "mcp__link-agent__reject_posts",
  "mcp__link-agent__finish_run",
  "ToolSearch",
  "mcp__claude-in-chrome__tabs_context_mcp",
  "mcp__claude-in-chrome__tabs_create_mcp",
  "mcp__claude-in-chrome__tabs_close_mcp",
  "mcp__claude-in-chrome__navigate",
  "mcp__claude-in-chrome__javascript_tool",
  "mcp__claude-in-chrome__computer",
];

type RunRecord = { id: string; pid: number; startedAt: string; log: string; pages: number; stopped?: boolean };

export type RunStatus = {
  state: "idle" | "running" | "done" | "failed";
  startedAt?: string;
  finishedAt?: string;
  /** Short, human description of what the agent is doing now, or how it ended. */
  message?: string;
  pagesDone?: number;
  pagesTotal?: number;
  newJobs?: number;
  /** New openings from this run per city, e.g. [["Hyderabad", 1], ["Mumbai", 2]]. */
  byCity?: [string, number][];
  /** The searches this run opened, in order ("Data Scientist · Hyderabad", "Home feed"). */
  searched?: string[];
};

function claudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const local = path.join(os.homedir(), ".local", "bin", "claude");
  return fs.existsSync(local) ? local : "claude";
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function current(): RunRecord | null {
  const raw = kvGet("agent_run");
  return raw ? (JSON.parse(raw) as RunRecord) : null;
}

type StreamEvent = {
  type: string;
  subtype?: string;
  result?: string;
  is_error?: boolean;
  message?: { content?: { type: string; name?: string; text?: string; input?: { url?: string } }[] };
};

/** Reads the session's stream-json log to work out progress and outcome. */
function readLog(file: string) {
  let pagesDone = 0;
  const searched: string[] = [];
  let lastText: string | null = null;
  let result: StreamEvent | null = null;
  if (!fs.existsSync(file)) return { pagesDone, lastText, result };
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.startsWith("{")) continue;
    let e: StreamEvent;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type === "result") result = e;
    if (e.type !== "assistant") continue;
    for (const c of e.message?.content ?? []) {
      if (c.type === "tool_use" && c.name?.endsWith("navigate") && c.input?.url?.includes("linkedin.com")) {
        pagesDone++;
        const u = new URL(c.input.url);
        searched.push(u.pathname.startsWith("/feed") ? "Home feed" : (u.searchParams.get("keywords") ?? "").replace(/^hiring\s+/i, ""));
      }
      if (c.type === "text" && c.text?.trim()) lastText = c.text.trim();
    }
  }
  return { pagesDone, lastText, result, searched };
}

/** Openings saved since `since`, counted per city. */
function newByCity(since: string): [string, number][] {
  const rows = db()
    .prepare("SELECT COALESCE(location, 'City not stated') AS city, COUNT(*) AS n FROM jobs WHERE found_at >= ? GROUP BY city ORDER BY n DESC")
    .all(since) as { city: string; n: number }[];
  return rows.map((r) => [r.city, Number(r.n)]);
}

export function runStatus(): RunStatus {
  const run = current();
  if (!run) return { state: "idle" };
  const { pagesDone, lastText, result, searched } = readLog(run.log);
  const base = { startedAt: run.startedAt, pagesDone, pagesTotal: run.pages, searched, byCity: newByCity(run.startedAt) };

  if (result) {
    const finishedAt = fs.statSync(run.log).mtime.toISOString();
    const last = lastRun();
    const newJobs = last && last.finishedAt >= run.startedAt ? last.newJobs : 0;
    const ok = result.subtype === "success" && !result.is_error;
    return { ...base, state: ok ? "done" : "failed", finishedAt, newJobs, message: result.result ?? lastText ?? undefined };
  }
  if (run.stopped && !alive(run.pid)) {
    return { ...base, state: "failed", message: "You stopped this search. Openings saved before it stopped are kept." };
  }
  if (alive(run.pid)) {
    const message =
      pagesDone === 0 ? "Starting Claude and opening LinkedIn in Chrome…" : `Reading LinkedIn: page ${Math.min(pagesDone, run.pages)} of ${run.pages}`;
    return { ...base, state: "running", message };
  }
  return {
    ...base,
    state: "failed",
    message: lastText ?? "The search stopped before finishing. Check that Chrome is open with the Claude extension connected.",
  };
}

export function startRun(): RunStatus {
  const status = runStatus();
  if (status.state === "running") return status;

  fs.mkdirSync(RUN_DIR, { recursive: true });
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const log = path.join(RUN_DIR, `${id}.jsonl`);
  const out = fs.openSync(log, "a");
  const s = getSettings().search;

  const child = spawn(
    claudeBin(),
    [
      "-p", "/find-jobs", "--chrome",
      "--mcp-config", path.join(process.cwd(), ".mcp.json"),
      "--allowedTools", ...ALLOWED_TOOLS,
      "--output-format", "stream-json", "--verbose",
    ],
    { cwd: process.cwd(), detached: true, stdio: ["ignore", out, out], env: process.env },
  );
  fs.closeSync(out);
  if (!child.pid) throw new Error("Couldn't start Claude Code. Is the claude command installed?");
  child.unref();

  const record: RunRecord = {
    id,
    pid: child.pid,
    startedAt: new Date().toISOString(),
    log,
    pages: s.maxSearchesPerRun + (s.scanFeed ? 1 : 0),
  };
  kvSet("agent_run", JSON.stringify(record));
  return runStatus();
}

export function stopRun(): RunStatus {
  const run = current();
  if (run && alive(run.pid)) {
    kvSet("agent_run", JSON.stringify({ ...run, stopped: true }));
    try {
      // The session was started in its own process group; stop it and anything it started.
      process.kill(-run.pid, "SIGTERM");
    } catch {
      process.kill(run.pid, "SIGTERM");
    }
  }
  return runStatus();
}
