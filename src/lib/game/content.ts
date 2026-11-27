import { promises as fs } from "node:fs";
import path from "node:path";
import { buildIndex, type MatchIndex } from "./match";
import { PROMPTS_PER_DAY } from "./tiers";
import type { DayContent, PromptContent } from "./types";

const DAYS_DIR = path.join(process.cwd(), "content", "days");

interface LoadedDay {
  content: DayContent;
  indexes: Map<string, MatchIndex>;
}

const cache = new Map<string, Promise<LoadedDay | null>>();
const mtimes = new Map<string, number>();

async function load(date: string): Promise<LoadedDay | null> {
  try {
    const file = path.join(DAYS_DIR, `${date}.json`);
    mtimes.set(date, (await fs.stat(file)).mtimeMs);
    const raw = await fs.readFile(file, "utf8");
    const content = JSON.parse(raw) as DayContent;
    if (!Array.isArray(content.prompts) || content.prompts.length !== PROMPTS_PER_DAY) {
      throw new Error(`content/days/${date}.json must hold exactly ${PROMPTS_PER_DAY} prompts`);
    }
    const indexes = new Map<string, MatchIndex>();
    for (const p of content.prompts) indexes.set(p.id, buildIndex(p));
    return { content, indexes };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function getDay(date: string): Promise<LoadedDay | null> {
  let p = cache.get(date);
  // In dev, pick up hand edits to a day file without a restart.
  if (p && process.env.NODE_ENV !== "production") {
    const stat = await fs.stat(path.join(DAYS_DIR, `${date}.json`)).catch(() => null);
    if (stat && stat.mtimeMs !== mtimes.get(date)) p = undefined;
  }
  if (!p) {
    p = load(date);
    cache.set(date, p);
    // Don't pin a missing day forever; content may land later today.
    p.then((v) => {
      if (!v) cache.delete(date);
    });
  }
  return p;
}

export async function getPrompt(date: string, promptId: string): Promise<{ prompt: PromptContent; index: MatchIndex } | null> {
  const day = await getDay(date);
  if (!day) return null;
  const prompt = day.content.prompts.find((p) => p.id === promptId);
  const index = day.indexes.get(promptId);
  if (!prompt || !index) return null;
  return { prompt, index };
}
