/**
 * Dictionary long tail for word prompts ("a word with Q but no U", palindromes…).
 * Uses the ENABLE list (the public-domain Scrabble-style list): real words only.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const ENABLE_URL = "https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt";

let words: string[] | null = null;

export async function loadWords(cacheDir: string): Promise<string[]> {
  if (words) return words;
  const file = path.join(cacheDir, "enable1.txt");
  let text: string;
  try {
    text = await fs.readFile(file, "utf8");
  } catch {
    const res = await fetch(ENABLE_URL, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`word list download failed: HTTP ${res.status}`);
    text = await res.text();
    await fs.mkdir(cacheDir, { recursive: true });
    await fs.writeFile(file, text);
  }
  words = text.split(/\r?\n/).map((w) => w.trim()).filter(Boolean);
  return words;
}

export interface WordFilter {
  /** JavaScript regex source tested against the lowercase word. */
  regex?: string;
  /** A JS arrow function `(w) => boolean`, for conditions a regex can't express. */
  jsFilter?: string;
  minLength?: number;
}

export async function filterWords(filter: WordFilter, cacheDir: string): Promise<string[]> {
  const all = await loadWords(cacheDir);
  const re = filter.regex ? new RegExp(filter.regex, "i") : null;
  // Dev-time pipeline code written by the LLM for this prompt; runs with the same trust as the script itself.
  const fn = filter.jsFilter ? (new Function(`return (${filter.jsFilter})`)() as (w: string) => boolean) : null;
  const min = filter.minLength ?? 2;
  return all.filter((w) => w.length >= min && (!re || re.test(w)) && (!fn || fn(w)));
}
