import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const RESUME_DIR = path.join(DATA_DIR, "resume");
const DB_PATH = path.join(DATA_DIR, "link-agent.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  post_key        TEXT NOT NULL UNIQUE,
  source          TEXT NOT NULL,
  role            TEXT NOT NULL,
  company         TEXT,
  location        TEXT,
  work_mode       TEXT,
  experience      TEXT,
  employment_type TEXT,
  summary         TEXT,
  skills          TEXT NOT NULL DEFAULT '[]',
  emails          TEXT NOT NULL DEFAULT '[]',
  apply_email     TEXT,
  poster_name     TEXT,
  poster_headline TEXT,
  poster_url      TEXT,
  post_url        TEXT,
  search_url      TEXT,
  post_text       TEXT NOT NULL,
  posted_at       TEXT,
  found_at        TEXT NOT NULL,
  matched_role    TEXT,
  score           REAL NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'new',
  notified        INTEGER NOT NULL DEFAULT 0,
  extracted_by    TEXT NOT NULL,
  draft_subject   TEXT,
  draft_body      TEXT
);
CREATE INDEX IF NOT EXISTS jobs_found_at ON jobs(found_at DESC);

-- Posts the agent already judged as not a fit, so later runs skip them.
CREATE TABLE IF NOT EXISTS rejected_posts (
  post_key TEXT PRIMARY KEY,
  reason   TEXT NOT NULL,
  seen_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id      INTEGER NOT NULL REFERENCES jobs(id),
  to_email    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body        TEXT NOT NULL,
  resume_file TEXT,
  sent_at     TEXT NOT NULL,
  message_id  TEXT,
  status      TEXT NOT NULL,
  error       TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  finished_at TEXT NOT NULL,
  searches    INTEGER NOT NULL,
  posts_seen  INTEGER NOT NULL,
  new_jobs    INTEGER NOT NULL,
  note        TEXT
);
`;

declare global {
  // Reused across Next.js hot reloads so we don't leak connections.
  var __linkAgentDb: DatabaseSync | undefined;
}

export function db(): DatabaseSync {
  if (!globalThis.__linkAgentDb) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const conn = new DatabaseSync(DB_PATH);
    // WAL lets the web app read while the background agent writes.
    conn.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    conn.exec(SCHEMA);
    migrate(conn);
    globalThis.__linkAgentDb = conn;
  }
  return globalThis.__linkAgentDb;
}

/** Columns added after the first release, for databases created before them. */
function migrate(conn: DatabaseSync): void {
  const cols = new Set((conn.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name));
  if (!cols.has("draft_subject")) conn.exec("ALTER TABLE jobs ADD COLUMN draft_subject TEXT");
  if (!cols.has("draft_body")) conn.exec("ALTER TABLE jobs ADD COLUMN draft_body TEXT");
}

export function kvGet(key: string): string | null {
  const row = db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  db()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

export function kvDelete(key: string): void {
  db().prepare("DELETE FROM kv WHERE key = ?").run(key);
}
