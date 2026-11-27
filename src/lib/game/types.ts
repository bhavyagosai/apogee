// Shared game types. Content files under content/days/*.json follow DayContent.

export type TierId = "paper" | "balloon" | "jet" | "orbit" | "deep" | "apogee";

/** A tier the server can return for a graded answer; `null` means not on the manifest (or timed out). */
export type ResultTier = TierId | null;

export interface AnswerEntry {
  /** Canonical display form, e.g. "Popular Electronics". */
  answer: string;
  /** Alternate spellings / names that should resolve to this answer. */
  aliases?: string[];
  tier: TierId;
  /** Only the apogee (gem) answer carries a one-line fun fact. */
  quip?: string;
}

export interface PromptContent {
  /** "p1" … "p7" */
  id: string;
  text: string;
  answers: AnswerEntry[];
}

export interface DayContent {
  /** UTC date, YYYY-MM-DD */
  date: string;
  prompts: PromptContent[];
}

export interface PublicPrompt {
  id: string;
  text: string;
}

export interface TodayResponse {
  date: string;
  dayNumber: number;
  resetsAt: string;
  prompts: PublicPrompt[];
}

export interface SubmitRequest {
  date: string;
  playerId: string;
  runId: string;
  promptId: string;
  /** Empty string = the countdown ran out. */
  answer: string;
}

export interface SubmitResponse {
  accepted: boolean;
  /** Canonical answer when accepted, otherwise what the player typed. */
  answer: string;
  tier: ResultTier;
  score: number;
  /** Only when the player lands the apogee: its fun fact. */
  quip?: string;
  /**
   * Signed proof of this grade; the client sends all seven back on completion.
   * Absent for a miss: the round isn't over, the player may try again.
   */
  receipt?: string;
}

export interface CompleteRequest {
  date: string;
  playerId: string;
  runId: string;
  receipts: string[];
}

export interface RoundResult {
  promptId: string;
  text: string;
  answer: string;
  tier: ResultTier;
  score: number;
  /** How many other players gave the same canonical answer today. */
  others: number;
}

export interface CompleteResponse {
  date: string;
  dayNumber: number;
  score: number;
  /** 0–100: share of today's completed runs this score beats. */
  betterThan: number;
  totalRuns: number;
  rounds: RoundResult[];
}

export interface RevealResponse {
  date: string;
  prompts: PromptContent[];
}
