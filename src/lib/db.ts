import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import path from "node:path";

/**
 * libsql: a local SQLite file in dev, Turso in production.
 * Only aggregate play data lives here; the answer sets are static content.
 */
let client: Client | null = null;
let ready: Promise<void> | null = null;

function connect(): Client {
  let url = process.env.DATABASE_URL;
  if (!url) {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      // Serverless filesystems are ephemeral: play still works, but counts and percentiles reset. Set DATABASE_URL (Turso).
      console.warn("DATABASE_URL is not set; using an ephemeral SQLite file in /tmp");
      url = "file:/tmp/apogee.db";
    } else {
      url = "file:data/apogee.db";
    }
  }
  if (url.startsWith("file:")) {
    mkdirSync(path.dirname(path.resolve(url.slice("file:".length))), { recursive: true });
  }
  return createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
}

async function migrate(c: Client) {
  await c.batch(
    [
      `CREATE TABLE IF NOT EXISTS runs (
        run_id TEXT PRIMARY KEY,
        player_id TEXT NOT NULL,
        date TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS runs_date_score ON runs (date, score)`,
      `CREATE TABLE IF NOT EXISTS submissions (
        run_id TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        date TEXT NOT NULL,
        answer TEXT NOT NULL,
        tier TEXT,
        score INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (run_id, prompt_id)
      )`,
      `CREATE TABLE IF NOT EXISTS answer_counts (
        date TEXT NOT NULL,
        prompt_id TEXT NOT NULL,
        answer TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, prompt_id, answer)
      )`,
    ],
    "write",
  );
}

export async function db(): Promise<Client> {
  if (!client) client = connect();
  if (!ready) ready = migrate(client);
  await ready;
  return client;
}

/** Records one graded answer; counts it toward today's popularity only the first time this run answers this prompt. */
export async function recordSubmission(args: {
  runId: string;
  promptId: string;
  date: string;
  answer: string;
  tier: string | null;
  score: number;
}) {
  const c = await db();
  const inserted = await c.execute({
    sql: `INSERT OR IGNORE INTO submissions (run_id, prompt_id, date, answer, tier, score, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [args.runId, args.promptId, args.date, args.answer, args.tier, args.score, Date.now()],
  });
  if (inserted.rowsAffected > 0 && args.tier) {
    await c.execute({
      sql: `INSERT INTO answer_counts (date, prompt_id, answer, count) VALUES (?, ?, ?, 1)
            ON CONFLICT (date, prompt_id, answer) DO UPDATE SET count = count + 1`,
      args: [args.date, args.promptId, args.answer],
    });
  }
}

export async function recordRun(args: { runId: string; playerId: string; date: string; score: number }) {
  const c = await db();
  await c.execute({
    sql: `INSERT OR IGNORE INTO runs (run_id, player_id, date, score, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [args.runId, args.playerId, args.date, args.score, Date.now()],
  });
}

export async function percentileFor(date: string, score: number): Promise<{ betterThan: number; totalRuns: number }> {
  const c = await db();
  const rs = await c.execute({
    sql: `SELECT COUNT(*) AS total, SUM(CASE WHEN score < ? THEN 1 ELSE 0 END) AS below FROM runs WHERE date = ?`,
    args: [score, date],
  });
  const total = Number(rs.rows[0]?.total ?? 0);
  const below = Number(rs.rows[0]?.below ?? 0);
  // Exclude the player's own run from the comparison.
  const others = Math.max(0, total - 1);
  return { betterThan: others === 0 ? 0 : Math.round((below / others) * 100), totalRuns: total };
}

export async function answerCounts(date: string, pairs: { promptId: string; answer: string }[]): Promise<Map<string, number>> {
  const c = await db();
  const out = new Map<string, number>();
  if (pairs.length === 0) return out;
  const rs = await c.batch(
    pairs.map((p) => ({
      sql: `SELECT count FROM answer_counts WHERE date = ? AND prompt_id = ? AND answer = ?`,
      args: [date, p.promptId, p.answer],
    })),
    "read",
  );
  rs.forEach((r, i) => {
    out.set(pairs[i].promptId, Number(r.rows[0]?.count ?? 0));
  });
  return out;
}
