#!/usr/bin/env tsx
/**
 * Apogee content pipeline.
 *
 *   pnpm curate --date 2026-11-26 --prompts prompts/2026-11-26.txt   # writes content/days/2026-11-26.json
 *   pnpm curate --prompt "Name a type of pasta shape"                 # dry run, prints stats
 *   pnpm curate ... --model sonnet                                    # pick the model (default: CLI default)
 *   pnpm curate ... --force                                           # ignore the response cache
 *
 * Per prompt: PLAN a long-tail source (Wikidata query / dictionary filter / none) →
 * GENERATE a wide answer list → AUDIT out invalid ones → TIER (the LLM list plus the
 * most familiar long-tail items) → append the rest of the long tail as "deep".
 * LLM calls go through the Claude Code CLI (`claude -p`) on the user's subscription;
 * every raw response is cached under content/cache/<sha>.json.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { normalize } from "../src/lib/game/normalize";
import { PROMPTS_PER_DAY } from "../src/lib/game/tiers";
import type { AnswerEntry, DayContent, PromptContent, TierId } from "../src/lib/game/types";
import { SparqlError, displayLabel, runSparql, type WikidataRow } from "./sources/wikidata";
import { filterWords, type WordFilter } from "./sources/wordlist";

// ---------- CLI args ----------

interface Args {
  date?: string;
  prompts?: string;
  prompt?: string;
  model?: string;
  force: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { force: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = argv[i + 1];
    if (k === "--date") a.date = v, i++;
    else if (k === "--prompts") a.prompts = v, i++;
    else if (k === "--prompt") a.prompt = v, i++;
    else if (k === "--model") a.model = v, i++;
    else if (k === "--force") a.force = true;
    else throw new Error(`Unknown arg ${k}`);
  }
  return a;
}

// ---------- LLM access (swappable) ----------

const ROOT = path.resolve(__dirname, "..");
const CACHE_DIR = path.join(ROOT, "content", "cache");
const SYSTEM = "You curate answer sets for a trivia word game. Be precise and factual. Output only JSON matching the schema.";

let MODEL: string | undefined;
let FORCE = false;

async function ask<T>(prompt: string, schema: object, label: string): Promise<T> {
  const key = createHash("sha256").update(JSON.stringify({ MODEL, SYSTEM, prompt, schema })).digest("hex");
  const cacheFile = path.join(CACHE_DIR, `${key}.json`);
  await fs.mkdir(CACHE_DIR, { recursive: true });

  if (!FORCE) {
    try {
      const cached = JSON.parse(await fs.readFile(cacheFile, "utf8"));
      process.stdout.write(`  ${label}: cached\n`);
      return cached.structured_output as T;
    } catch {}
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    const t0 = Date.now();
    const raw = await runClaude(prompt, schema);
    let parsed: { structured_output?: T; result?: string; is_error?: boolean; total_cost_usd?: number };
    try {
      parsed = JSON.parse(raw);
    } catch {
      process.stderr.write(`  ${label}: non-JSON output from claude (attempt ${attempt})\n${raw.slice(0, 500)}\n`);
      continue;
    }
    let out = parsed.structured_output;
    if (!out && parsed.result) {
      try {
        out = JSON.parse(parsed.result.replace(/^```(?:json)?\s*|\s*```$/g, "")) as T;
      } catch {}
    }
    if (parsed.is_error || !out) {
      process.stderr.write(`  ${label}: no structured output (attempt ${attempt}): ${(parsed.result ?? raw).slice(0, 300)}\n`);
      continue;
    }
    await fs.writeFile(cacheFile, JSON.stringify({ ...parsed, structured_output: out }, null, 1));
    process.stdout.write(`  ${label}: ${((Date.now() - t0) / 1000).toFixed(0)}s${parsed.total_cost_usd ? ` ($${parsed.total_cost_usd.toFixed(2)} list)` : ""}\n`);
    return out;
  }
  throw new Error(`${label}: LLM call failed twice`);
}

function runClaude(prompt: string, schema: object): Promise<string> {
  const args = [
    "-p", prompt,
    "--output-format", "json",
    "--json-schema", JSON.stringify(schema),
    "--system-prompt", SYSTEM,
    "--tools", "",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--disable-slash-commands",
  ];
  if (MODEL) args.push("--model", MODEL);
  return new Promise((resolve, reject) => {
    // CLAUDECODE is unset so the CLI doesn't refuse to run inside another session.
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const child = spawn("claude", args, { env, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`claude exited ${code}: ${err || out}`))));
  });
}

// ---------- Schemas ----------

const GENERATE_SCHEMA = {
  type: "object",
  properties: {
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: {
          answer: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
        },
        required: ["answer", "aliases"],
      },
    },
  },
  required: ["answers"],
};

const AUDIT_SCHEMA = {
  type: "object",
  properties: {
    invalid: {
      type: "array",
      items: {
        type: "object",
        properties: { answer: { type: "string" }, reason: { type: "string" } },
        required: ["answer", "reason"],
      },
    },
  },
  required: ["invalid"],
};

const TIER_SCHEMA = {
  type: "object",
  properties: {
    paper: { type: "array", items: { type: "string" } },
    balloon: { type: "array", items: { type: "string" } },
    jet: { type: "array", items: { type: "string" } },
    orbit: { type: "array", items: { type: "string" } },
    apogee: {
      type: "object",
      properties: { answer: { type: "string" }, quip: { type: "string" } },
      required: ["answer", "quip"],
    },
  },
  required: ["paper", "balloon", "jet", "orbit", "apogee"],
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    source: { type: "string", enum: ["wikidata", "wordlist", "none"] },
    reason: { type: "string" },
    wikidata: {
      type: "object",
      properties: { where: { type: "string" }, notes: { type: "string" } },
      required: ["where", "notes"],
    },
    wordlist: {
      type: "object",
      properties: { regex: { type: "string" }, jsFilter: { type: "string" }, minLength: { type: "integer" } },
    },
  },
  required: ["source", "reason"],
};

interface Plan {
  source: "wikidata" | "wordlist" | "none";
  reason: string;
  wikidata?: { where: string; notes: string };
  wordlist?: WordFilter;
}

interface Generated { answers: { answer: string; aliases: string[] }[] }
interface Audit { invalid: { answer: string; reason: string }[] }
interface Tiering { paper: string[]; balloon: string[]; jet: string[]; orbit: string[]; apogee: { answer: string; quip: string } }

// ---------- Pipeline steps ----------

const GENERATE_TARGET = 250;
/** How many of the most familiar long-tail items join the LLM list for auditing and tiering. */
const LONG_TAIL_TIER_TOP = 150;
/** A long-tail result this large means the query was too broad. */
const LONG_TAIL_MAX = 15_000;
/**
 * Spot-check the tail with a sample. Mostly clean → keep it; mostly junk → drop
 * it; in between → audit every item in batches (slower, but it saves tails like
 * dinosaur genera where only the deep end is polluted by fossil birds).
 */
const TAIL_SAMPLE = 60;
const TAIL_KEEP_SHARE = 0.1;
const TAIL_REJECT_SHARE = 0.5;
const TAIL_AUDIT_BATCH = 250;
const TAIL_AUDIT_PARALLEL = 3;

function planPrompt(prompt: string, feedback?: string): string {
  return `Game prompt: "${prompt}"

We want the COMPLETE long tail of valid answers, not just the ones an LLM remembers. Decide which source can enumerate them:

- "wikidata": the answers are named entities or kinds of thing that Wikidata models as a class (films, rivers, countries, species, pasta types, board games, bands…). Write ONLY the SPARQL WHERE body that binds ?item. We wrap it with English labels, aliases, sitelink counts, ORDER and LIMIT ourselves, so do not add those.
  Patterns: instances of a class → \`?item wdt:P31/wdt:P279* wd:Qxxx .\`; kinds/types of a thing → \`?item wdt:P279* wd:Qxxx .\` (UNION both when unsure); taxa → \`?item wdt:P105 wd:Q34740 ; wdt:P171* wd:Qxxx .\` (genus level); conditions via properties (award P166, country P17, length in km P2043, population P1082, located on coast via P206/P138 or similar, inception P571…).
  Pitfalls: the class item itself comes back (add \`FILTER(?item != wd:Qxxx)\`); classes include things players wouldn't mean (birds are dinosaurs, fictional films are films). The service kills queries after 60 s: MINUS / FILTER NOT EXISTS over a recursive path (e.g. \`MINUS { ?item wdt:P171* wd:Q5113 }\`) almost always times out, so prefer a cheap POSITIVE constraint instead — e.g. extinct taxa are \`?item wdt:P31 wd:Q23038290\` (fossil taxon), real films have \`wdt:P577\` (publication date). Keep it under ~15,000 results. Only use QIDs/PIDs you are confident about; a wrong QID returns nothing.
- "wordlist": the answers are dictionary words with a spelling/letter condition. Give a JS regex (tested case-insensitively) and/or a jsFilter arrow function \`(w) => boolean\`, plus minLength.
- "none": the answers are everyday things, categories, or anything no dataset enumerates cleanly (things in a toolbox, things with a handle, info on a scoreboard).

Explain your choice briefly in "reason".${feedback ? `

PREVIOUS ATTEMPT FAILED — fix it:
${feedback}` : ""}`;
}

function generatePrompt(prompt: string, exclude: string[] = []): string {
  const more = exclude.length
    ? `\n\nThese are ALREADY listed — do not repeat them, add OTHER valid answers, going more obscure:\n${exclude.join("; ")}`
    : "";
  return `Game prompt: "${prompt}"

Produce the most complete list you can of valid answers to this prompt, as a general-knowledge player would give them. If the set is finite and small (e.g. all countries that match), list ALL of them. Otherwise aim for ${exclude.length ? 150 : 300}+ answers, spanning the obvious ones everyone knows down to genuinely obscure but real ones.

Rules:
- "answer": canonical name in normal casing (e.g. "Farfalle", "The Godfather", "Lagos").
- "aliases": other names and spellings a player might type — alternative names, with/without "The", abbreviations, common misspellings, singular/plural, transliterations. Empty array if none.
- Every answer must truly satisfy the prompt. No near-misses, no jokes, no duplicates.
- Generic categories ("a big river") are not answers; specific named things are.${more}`;
}

function auditPrompt(prompt: string, answers: string[]): string {
  return `Game prompt: "${prompt}"

Below is a candidate answer list. Flag every entry that does NOT genuinely satisfy the prompt (wrong category, factually wrong, fictional when the prompt implies real, doesn't meet a stated condition, or is a generic category rather than a specific thing). Be strict about the prompt's conditions but do not flag valid-but-obscure answers. Return an empty list if all are valid.

Candidates:
${answers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
}

function tierPrompt(prompt: string, answers: string[]): string {
  return `Game prompt: "${prompt}"

Players have 25 seconds to type ONE answer. Rarer answers score more. Your job is to predict, for each valid answer below, what share of random English-speaking adult players would type it, and sort them into tiers:

- paper: the 3–12 answers most people blurt out first. The obvious ones.
- balloon: 0–5 answers that FEEL obscure but are actually everyone's go-to "clever" pick (the thing a player reaches for when trying to be sneaky). May be empty.
- jet: roughly 20–70 solid, well-known answers a lot of people would give.
- orbit: roughly 40–200 genuinely uncommon answers that only a minority would think of.
- (everything you do not list is "deep": valid but obscure — most players have never heard of it.)
- apogee: EXACTLY ONE gem. Obscure, but FUN and gettable — the answer that is most satisfying to land on, not the single most obscure one. Give a "quip": one sentence, under 110 characters, a specific and verifiable fun fact about it.

Use the answer strings exactly as written. Each answer belongs to at most one tier. Think about actual player behaviour: famous ≠ what people say first, and a well-known thing can still be "orbit" if people rarely think of it for THIS prompt.

Answers:
${answers.map((a, i) => `${i + 1}. ${a}`).join("\n")}`;
}

interface PromptStats {
  text: string;
  source: string;
  longTail: number;
  generated: number;
  audited: number;
  dropped: string[];
  tiers: Record<TierId, number>;
  apogee: { answer: string; quip: string };
  seconds: number;
}

async function curatePrompt(id: string, text: string): Promise<{ content: PromptContent; stats: PromptStats }> {
  const t0 = Date.now();
  process.stdout.write(`\n[${id}] ${text}\n`);

  // 0. plan + fetch the long tail (Wikidata / dictionary), ordered most familiar first
  const { source, tail } = await longTail(text);
  const generated0 = tail.length;

  // 1. generate (+ one top-up pass if the first list came back thin)
  const gen = await ask<Generated>(generatePrompt(text), GENERATE_SCHEMA, "generate");
  let raw = gen.answers;
  if (raw.length < GENERATE_TARGET) {
    const more = await ask<Generated>(generatePrompt(text, raw.map((a) => a.answer)), GENERATE_SCHEMA, "generate+");
    raw = raw.concat(more.answers);
  }
  // The most familiar long-tail items the LLM didn't name join the list that gets audited and tiered;
  // the rest are appended as "deep" at the end.
  const llmKeys = new Set<string>();
  for (const r of raw) for (const f of [r.answer, ...(r.aliases ?? [])]) llmKeys.add(normalize(f));
  const fresh = tail.filter((t) => !llmKeys.has(normalize(t.answer)) && !t.aliases.some((a) => llmKeys.has(normalize(a))));
  const tierable = fresh.slice(0, LONG_TAIL_TIER_TOP);
  let rest = fresh.slice(LONG_TAIL_TIER_TOP);
  let sourceLabel = source;
  // The tail is never fully audited, so spot-check it: a class that drags in
  // nonsense ("hand tool" → circle, sphere, cube) is thrown away whole.
  if (rest.length > 0) {
    const step = Math.max(1, Math.floor(rest.length / TAIL_SAMPLE));
    const sample = rest.filter((_, i) => i % step === 0).slice(0, TAIL_SAMPLE);
    const check = await ask<Audit>(auditPrompt(text, sample.map((c) => c.answer)), AUDIT_SCHEMA, "tail-check");
    const badShare = check.invalid.length / sample.length;
    const pct = Math.round(badShare * 100);
    if (badShare > TAIL_REJECT_SHARE) {
      process.stdout.write(`  tail rejected: ${pct}% of a ${sample.length}-item sample was invalid (${check.invalid.slice(0, 6).map((x) => x.answer).join(", ")}…)\n`);
      rest = [];
      sourceLabel = `${source} (tail rejected)`;
    } else if (badShare > TAIL_KEEP_SHARE) {
      const before = rest.length;
      const bad = await auditAll(text, rest.map((c) => c.answer));
      rest = rest.filter((c) => !bad.has(normalize(c.answer)));
      process.stdout.write(`  tail audited in full: ${pct}% invalid in sample → ${before - rest.length} dropped, keeping ${rest.length}\n`);
      sourceLabel = `${source} (tail audited)`;
    } else {
      const bad = new Set(check.invalid.map((x) => normalize(x.answer)));
      rest = rest.filter((c) => !bad.has(normalize(c.answer)));
      process.stdout.write(`  tail check: ${pct}% invalid in sample, keeping ${rest.length}\n`);
    }
  }
  let entries = dedupe(raw.concat(tierable));
  const generated = entries.length;

  // 2. audit
  const audit = await ask<Audit>(auditPrompt(text, entries.map((e) => e.answer)), AUDIT_SCHEMA, "audit");
  const bad = new Set(audit.invalid.map((x) => normalize(x.answer)));
  const dropped = entries.filter((e) => bad.has(normalize(e.answer))).map((e) => e.answer);
  entries = entries.filter((e) => !bad.has(normalize(e.answer)));
  if (entries.length < 20) throw new Error(`[${id}] only ${entries.length} answers survived the audit`);

  // 3. tier
  const tiering = await ask<Tiering>(tierPrompt(text, entries.map((e) => e.answer)), TIER_SCHEMA, "tier");
  const byKey = new Map(entries.map((e) => [normalize(e.answer), e]));
  const assigned = new Map<string, TierId>();
  const assign = (names: string[], tier: TierId) => {
    for (const n of names) {
      const k = normalize(n);
      if (byKey.has(k) && !assigned.has(k)) assigned.set(k, tier);
      else if (!byKey.has(k)) process.stderr.write(`  tier: unknown answer "${n}" ignored\n`);
    }
  };
  // Apogee first so it can't be shadowed by a lower tier naming the same answer.
  assign([tiering.apogee.answer], "apogee");
  if (!assigned.has(normalize(tiering.apogee.answer))) throw new Error(`[${id}] apogee "${tiering.apogee.answer}" is not in the answer list`);
  assign(tiering.paper, "paper");
  assign(tiering.balloon, "balloon");
  assign(tiering.jet, "jet");
  assign(tiering.orbit, "orbit");

  const answers: AnswerEntry[] = entries.map((e) => {
    const tier = assigned.get(normalize(e.answer)) ?? "deep";
    const entry: AnswerEntry = { answer: e.answer, tier };
    if (e.aliases.length) entry.aliases = e.aliases;
    if (tier === "apogee") entry.quip = tiering.apogee.quip.trim();
    return entry;
  });
  // Long tail: everything the audit didn't see, as deep cuts (dedupe keeps the audited list's spellings).
  for (const e of dedupe(answers.map((a) => ({ answer: a.answer, aliases: a.aliases ?? [] })).concat(rest)).slice(answers.length)) {
    const entry: AnswerEntry = { answer: e.answer, tier: "deep" };
    if (e.aliases.length) entry.aliases = e.aliases;
    answers.push(entry);
  }

  // 4. validate
  const tiers = count(answers);
  if (tiers.apogee !== 1) throw new Error(`[${id}] expected exactly one apogee, got ${tiers.apogee}`);
  if (tiers.paper === 0) throw new Error(`[${id}] no paper-tier answers`);

  const stats: PromptStats = {
    text,
    source: sourceLabel,
    longTail: generated0,
    generated,
    audited: entries.length,
    dropped,
    tiers,
    apogee: { answer: tiering.apogee.answer, quip: tiering.apogee.quip },
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  process.stdout.write(`  ${fmtTiers(tiers)} | ${answers.length} total | apogee: ${stats.apogee.answer} — ${stats.apogee.quip}\n`);
  if (dropped.length) process.stdout.write(`  audit dropped ${dropped.length}: ${dropped.slice(0, 12).join(", ")}${dropped.length > 12 ? "…" : ""}\n`);
  return { content: { id, text, answers }, stats };
}

type Candidate = { answer: string; aliases: string[] };

/** Audits a long list in batches, a few at a time; returns the normalized keys flagged invalid. */
async function auditAll(text: string, answers: string[]): Promise<Set<string>> {
  const batches: string[][] = [];
  for (let i = 0; i < answers.length; i += TAIL_AUDIT_BATCH) batches.push(answers.slice(i, i + TAIL_AUDIT_BATCH));
  const bad = new Set<string>();
  for (let i = 0; i < batches.length; i += TAIL_AUDIT_PARALLEL) {
    const group = batches.slice(i, i + TAIL_AUDIT_PARALLEL);
    const results = await Promise.all(
      group.map((b, j) => ask<Audit>(auditPrompt(text, b), AUDIT_SCHEMA, `tail-audit ${i + j + 1}/${batches.length}`)),
    );
    for (const r of results) for (const x of r.invalid) bad.add(normalize(x.answer));
  }
  return bad;
}

/** Plans and fetches the long tail for a prompt; falls back to nothing rather than failing the prompt. */
async function longTail(text: string): Promise<{ source: string; tail: Candidate[] }> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const plan = await ask<Plan>(planPrompt(text, feedback), PLAN_SCHEMA, attempt === 1 ? "plan" : `plan#${attempt}`);
    process.stdout.write(`  source: ${plan.source} — ${plan.reason}\n`);
    if (plan.source === "none") return { source: "none", tail: [] };

    if (plan.source === "wordlist" && plan.wordlist) {
      try {
        const words = await filterWords(plan.wordlist, CACHE_DIR);
        if (words.length === 0) throw new Error("the filter matched no words");
        if (words.length > LONG_TAIL_MAX) throw new Error(`the filter matched ${words.length} words — far too broad`);
        process.stdout.write(`  wordlist: ${words.length} words\n`);
        return { source: "wordlist", tail: words.map((w) => ({ answer: displayLabel(w), aliases: [] })) };
      } catch (err) {
        feedback = `wordlist filter ${JSON.stringify(plan.wordlist)} failed: ${(err as Error).message}`;
      }
    } else if (plan.source === "wikidata" && plan.wikidata) {
      try {
        const t0 = Date.now();
        const rows = await runSparql(plan.wikidata.where, CACHE_DIR, FORCE);
        if (rows.length === 0) throw new SparqlError("the query returned 0 rows — check the QIDs and the class pattern (P31/P279* vs P279*)");
        if (rows.length > LONG_TAIL_MAX) throw new SparqlError(`the query returned ${rows.length} rows — too broad, tighten the class or add conditions`);
        process.stdout.write(`  wikidata: ${rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s · top: ${rows.slice(0, 6).map((r) => r.label).join(", ")}\n`);
        return { source: "wikidata", tail: rows.map(toCandidate).filter((c): c is Candidate => c !== null) };
      } catch (err) {
        feedback = `SPARQL WHERE body:\n${plan.wikidata.where}\nfailed: ${(err as Error).message.slice(0, 600)}`;
        process.stderr.write(`  wikidata attempt ${attempt} failed: ${(err as Error).message.slice(0, 200)}\n`);
      }
    } else {
      feedback = `source "${plan.source}" was chosen but its parameters were missing`;
    }
  }
  process.stderr.write(`  long tail unavailable after 2 attempts; continuing with the LLM list only\n`);
  return { source: "none (failed)", tail: [] };
}

/** A Wikidata row as an answer candidate, or null when the label is junk. */
function toCandidate(row: WikidataRow): Candidate | null {
  let label = row.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!label || label.length > 60 || label.includes("/") || /^\d+$/.test(label)) return null;
  label = displayLabel(label);
  return { answer: label, aliases: row.aliases.map(displayLabel) };
}

/** Dedupe canonical answers and aliases by normalized key. Canonicals win over aliases; first occurrence wins. */
function dedupe(raw: { answer: string; aliases: string[] }[]): { answer: string; aliases: string[] }[] {
  const seen = new Set<string>();
  const kept: { answer: string; aliases: string[] }[] = [];
  for (const r of raw) {
    const answer = r.answer.trim();
    const k = normalize(answer);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    kept.push({ answer, aliases: (r.aliases ?? []).map((a) => a.trim()).filter(Boolean) });
  }
  for (const e of kept) {
    const aliases: string[] = [];
    for (const a of e.aliases) {
      const k = normalize(a);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      aliases.push(a);
    }
    e.aliases = aliases;
  }
  return kept;
}

function count(answers: AnswerEntry[]): Record<TierId, number> {
  const c: Record<TierId, number> = { paper: 0, balloon: 0, jet: 0, orbit: 0, deep: 0, apogee: 0 };
  for (const a of answers) c[a.tier]++;
  return c;
}

function fmtTiers(t: Record<TierId, number>): string {
  return `paper ${t.paper} · balloon ${t.balloon} · jet ${t.jet} · orbit ${t.orbit} · deep ${t.deep} · apogee ${t.apogee}`;
}

// ---------- manual overrides ----------

interface Override {
  note?: string;
  add?: AnswerEntry[];
  remove?: string[];
}

/**
 * content/overrides/<date>.json — the human skim, kept out of the generated
 * file so a regeneration can't lose it. Adds replace an existing answer of the
 * same key (so a tier can be corrected); removes drop by answer or alias.
 */
async function applyOverrides(date: string, prompts: PromptContent[]) {
  let overrides: Record<string, Override>;
  try {
    overrides = JSON.parse(await fs.readFile(path.join(ROOT, "content", "overrides", `${date}.json`), "utf8"));
  } catch {
    return;
  }
  for (const prompt of prompts) {
    const o = overrides[prompt.id];
    if (!o) continue;
    const removeKeys = new Set((o.remove ?? []).map(normalize));
    const addKeys = new Set((o.add ?? []).map((a) => normalize(a.answer)));
    prompt.answers = prompt.answers.filter((a) => {
      const keys = [a.answer, ...(a.aliases ?? [])].map(normalize);
      return !keys.some((k) => removeKeys.has(k)) && !keys.some((k) => addKeys.has(k));
    });
    for (const a of o.add ?? []) prompt.answers.push(a);
    process.stdout.write(`  overrides for ${prompt.id}: +${o.add?.length ?? 0} −${o.remove?.length ?? 0}\n`);
  }
}

// ---------- main ----------

async function main() {
  const args = parseArgs(process.argv.slice(2));
  MODEL = args.model;
  FORCE = args.force;

  if (args.prompt) {
    const { content, stats } = await curatePrompt("p1", args.prompt);
    process.stdout.write(`\npaper: ${content.answers.filter((a) => a.tier === "paper").map((a) => a.answer).join(", ")}\n`);
    process.stdout.write(`balloon: ${content.answers.filter((a) => a.tier === "balloon").map((a) => a.answer).join(", ")}\n`);
    process.stdout.write(`${stats.seconds}s\n`);
    return;
  }

  if (!args.date || !args.prompts) {
    process.stderr.write("usage: pnpm curate --date YYYY-MM-DD --prompts file.txt [--model m] [--force]\n       pnpm curate --prompt \"Name a …\"\n");
    process.exit(2);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("--date must be YYYY-MM-DD");

  const lines = (await fs.readFile(path.resolve(args.prompts), "utf8")).split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length !== PROMPTS_PER_DAY) throw new Error(`${args.prompts} must contain exactly ${PROMPTS_PER_DAY} prompts, found ${lines.length}`);

  const prompts: PromptContent[] = [];
  const allStats: PromptStats[] = [];
  for (let i = 0; i < lines.length; i++) {
    const { content, stats } = await curatePrompt(`p${i + 1}`, lines[i]);
    prompts.push(content);
    allStats.push(stats);
  }

  await applyOverrides(args.date, prompts);
  const day: DayContent = { date: args.date, prompts };
  const outFile = path.join(ROOT, "content", "days", `${args.date}.json`);
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify(day));

  process.stdout.write(`\nwrote ${path.relative(ROOT, outFile)}\n`);
  for (const s of allStats) {
    process.stdout.write(`- ${s.text}: ${s.audited} audited (${s.generated} candidates, ${s.dropped.length} dropped) + ${s.source} long tail ${s.longTail} · ${fmtTiers(s.tiers)} · ${s.seconds}s\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`\n${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exit(1);
});
