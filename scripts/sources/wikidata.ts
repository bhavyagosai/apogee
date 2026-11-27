/**
 * Wikidata long tail. The LLM writes only the WHERE body (which class, which
 * conditions); the SELECT, labels, aliases and familiarity ordering are fixed
 * here so every query comes back in the same shape.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const ENDPOINT = "https://query.wikidata.org/sparql";
const USER_AGENT = "ApogeeCurate/0.1 (https://github.com/bhavyagosai; content pipeline)";
const LIMIT = 20_000;

export interface WikidataRow {
  id: string;
  label: string;
  aliases: string[];
  /** Number of Wikipedia-family articles about the item: our familiarity proxy. */
  sitelinks: number;
}

export function wrapQuery(whereBody: string): string {
  return `SELECT ?item ?label ?sitelinks (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?aliases) WHERE {
${whereBody.trim()}
  ?item rdfs:label ?label . FILTER(LANG(?label) = "en")
  ?item wikibase:sitelinks ?sitelinks . FILTER(?sitelinks > 0)
  OPTIONAL { ?item skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
} GROUP BY ?item ?label ?sitelinks ORDER BY DESC(?sitelinks) LIMIT ${LIMIT}`;
}

export class SparqlError extends Error {}

export async function runSparql(whereBody: string, cacheDir: string, force = false): Promise<WikidataRow[]> {
  const query = wrapQuery(whereBody);
  const key = createHash("sha256").update(query).digest("hex");
  const cacheFile = path.join(cacheDir, `sparql-${key}.json`);
  if (!force) {
    try {
      return JSON.parse(await fs.readFile(cacheFile, "utf8")) as WikidataRow[];
    } catch {}
  }

  const url = `${ENDPOINT}?query=${encodeURIComponent(query)}`;
  // WDQS kills queries at 60 s and answers 500; that's deterministic, so only
  // rate limiting (429/503) is worth a retry.
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(90_000),
    });
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    break;
  }
  if (!res) throw new SparqlError("no response");
  const text = await res.text();
  if (!res.ok) {
    const timedOut = /TimeoutException|timed out/i.test(text);
    throw new SparqlError(timedOut ? "WDQS timed out after 60 s — the query is too heavy; use a narrower class, avoid deep P171*/P279* recursion, or add a cheap filter first" : `HTTP ${res.status}: ${text.slice(0, 400)}`);
  }

  let parsed: { results: { bindings: Record<string, { value: string }>[] } };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new SparqlError(`non-JSON response: ${text.slice(0, 200)}`);
  }

  const seen = new Set<string>();
  const rows: WikidataRow[] = [];
  for (const b of parsed.results.bindings) {
    const label = b.label?.value?.trim();
    if (!label || /^Q\d+$/.test(label) || seen.has(label)) continue;
    seen.add(label);
    rows.push({
      id: b.item.value.replace(/.*\//, ""),
      label,
      aliases: (b.aliases?.value ?? "")
        .split("|")
        .map((a) => a.trim())
        .filter((a) => a && a.length <= 60 && /[a-z]/i.test(a) && a !== label),
      sitelinks: Number(b.sitelinks?.value ?? 0),
    });
  }
  await fs.mkdir(cacheDir, { recursive: true });
  await fs.writeFile(cacheFile, JSON.stringify(rows));
  return rows;
}

/** Wikidata labels for common nouns are lowercase; the game shows them capitalised. */
export function displayLabel(label: string): string {
  return /^[a-z]/.test(label) ? label[0].toUpperCase() + label.slice(1) : label;
}
