import { editDistance, normalize, toleranceFor } from "./normalize";
import type { AnswerEntry, PromptContent } from "./types";

interface Phrase {
  key: string;
  tokens: string[];
}

export interface MatchIndex {
  exact: Map<string, AnswerEntry>;
  keys: string[];
  /** Multi-word keys, for the word-overlap fallback. */
  phrases: Phrase[];
}

export function buildIndex(prompt: PromptContent): MatchIndex {
  const exact = new Map<string, AnswerEntry>();
  for (const entry of prompt.answers) {
    const forms = [entry.answer, ...(entry.aliases ?? [])];
    for (const form of forms) {
      const key = normalize(form);
      if (!key) continue;
      // First writer wins so a canonical answer beats a later alias collision.
      if (!exact.has(key)) exact.set(key, entry);
    }
  }
  const keys = [...exact.keys()];
  const phrases = keys.map((key) => ({ key, tokens: key.split(" ") })).filter((p) => p.tokens.length >= 2);
  return { exact, keys, phrases };
}

export interface MatchResult {
  entry: AnswerEntry;
  /** 0 for an exact hit, otherwise the number of edits forgiven. */
  distance: number;
}

export function matchAnswer(index: MatchIndex, raw: string): MatchResult | null {
  const key = normalize(raw);
  if (!key) return null;
  const hit = index.exact.get(key);
  if (hit) return { entry: hit, distance: 0 };

  return fuzzyMatch(index, key) ?? overlapMatch(index, key);
}

/** Whole-string typo tolerance: one or two edits depending on length. */
function fuzzyMatch(index: MatchIndex, key: string): MatchResult | null {
  const max = toleranceFor(key);
  if (max === 0) return null;

  let best: MatchResult | null = null;
  for (const candidate of index.keys) {
    if (Math.abs(candidate.length - key.length) > max) continue;
    const d = editDistance(key, candidate, max);
    if (d > max) continue;
    if (!best || d < best.distance) {
      best = { entry: index.exact.get(candidate)!, distance: d };
      if (d === 1) break;
    }
  }
  return best;
}

/** Words that don't count as evidence on their own. */
const STOP = new Set(["the", "a", "an", "of", "and", "in", "on", "at", "to", "for", "de", "la", "le", "el", "du", "da"]);

/** Minimum share of an answer's words the player must have typed. */
const OVERLAP_RATIO = 0.75;
/** …and at least this many of them must be real words, not "of the". */
const MIN_CONTENT_WORDS = 2;
/** Padding beyond the answer's own length, so a paragraph can't fish for matches. */
const EXTRA_WORDS = 3;

/**
 * "a bird flew over the cuckoo's nest" → One Flew Over the Cuckoo's Nest.
 * Accepts a multi-word answer when most of its words were typed, each word
 * matched exactly or within one typo for longer words.
 */
function overlapMatch(index: MatchIndex, key: string): MatchResult | null {
  const typed = key.split(" ");
  if (typed.length < 2) return null;
  const typedSet = new Set(typed);

  const wordHit = (w: string) =>
    typedSet.has(w) || (w.length >= 5 && typed.some((t) => Math.abs(t.length - w.length) <= 1 && editDistance(t, w, 1) <= 1));

  let best: { phrase: Phrase; ratio: number } | null = null;
  for (const phrase of index.phrases) {
    if (typed.length > phrase.tokens.length + EXTRA_WORDS) continue;
    const common = phrase.tokens.filter(wordHit);
    const ratio = common.length / phrase.tokens.length;
    if (ratio < OVERLAP_RATIO) continue;
    if (common.filter((w) => !STOP.has(w) && w.length >= 3).length < MIN_CONTENT_WORDS) continue;
    // Prefer the better-covered answer; on a tie, the more specific (longer) one.
    if (!best || ratio > best.ratio || (ratio === best.ratio && phrase.tokens.length > best.phrase.tokens.length)) {
      best = { phrase, ratio };
    }
  }
  return best ? { entry: index.exact.get(best.phrase.key)!, distance: 2 } : null;
}
