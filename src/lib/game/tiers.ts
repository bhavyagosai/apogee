import type { ResultTier, TierId } from "./types";

export interface TierDef {
  id: TierId;
  name: string;
  score: number;
  emoji: string;
  blurb: string;
  /** 0–1, how far along the reveal ladder the marker lands. */
  ladder: number;
  /** CSS custom property carrying the tier colour. */
  color: string;
}

export const TIERS: Record<TierId, TierDef> = {
  paper: {
    id: "paper",
    name: "Paper Plane",
    score: 10,
    emoji: "🛩️",
    blurb: "The answer everyone blurts out. Barely left your hand.",
    ladder: 0.08,
    color: "var(--tier-paper)",
  },
  balloon: {
    id: "balloon",
    name: "Weather Balloon",
    score: 15,
    emoji: "🎈",
    blurb: "The famously “clever” pick. Everyone reaches for it.",
    ladder: 0.18,
    color: "var(--tier-balloon)",
  },
  jet: {
    id: "jet",
    name: "Jetliner",
    score: 30,
    emoji: "✈️",
    blurb: "Cruising altitude. Solid — flying with the crowd.",
    ladder: 0.36,
    color: "var(--tier-jet)",
  },
  orbit: {
    id: "orbit",
    name: "Orbiter",
    score: 60,
    emoji: "🛰️",
    blurb: "Genuinely uncommon. You made orbit.",
    ladder: 0.6,
    color: "var(--tier-orbit)",
  },
  deep: {
    id: "deep",
    name: "Deep Space",
    score: 85,
    emoji: "🪐",
    blurb: "True obscurity. Past the planets.",
    ladder: 0.82,
    color: "var(--tier-deep)",
  },
  apogee: {
    id: "apogee",
    name: "Apogee",
    score: 100,
    emoji: "☄️",
    blurb: "One in a billion. The farthest point.",
    ladder: 0.97,
    color: "var(--tier-apogee)",
  },
};

/** Ladder order, lowest to highest. */
export const TIER_ORDER: TierId[] = ["paper", "balloon", "jet", "orbit", "deep", "apogee"];

export const MISS = {
  name: "Scrubbed",
  emoji: "✖️",
  blurb: "Launch scrubbed. That one isn't on the manifest.",
  timeoutBlurb: "The countdown beat you to it.",
  color: "var(--tier-scrub)",
};

export const PROMPTS_PER_DAY = 7;
export const ANSWER_MS = 25_000;
export const PREVIEW_MS = 3_000;
export const MAX_ANSWER_LENGTH = 256;
export const MAX_SCORE = PROMPTS_PER_DAY * TIERS.apogee.score;

export function tierScore(tier: ResultTier): number {
  return tier ? TIERS[tier].score : 0;
}

export function tierEmoji(tier: ResultTier): string {
  return tier ? TIERS[tier].emoji : MISS.emoji;
}

/** End-of-flight verdict bands on the total score. */
export const DEBRIEF_BANDS = [
  { min: 0, max: 150, name: "Suborbital", line: "A nice hop. Plenty of sky left up there." },
  { min: 151, max: 250, name: "Low orbit", line: "You made it to space. Officially an astronaut." },
  { min: 251, max: 350, name: "Lunar", line: "Past the Moon. Twelve people have been this far." },
  { min: 351, max: 449, name: "Interplanetary", line: "Seriously far. Mars is in the rear-view." },
  { min: 450, max: Infinity, name: "Interstellar", line: "Voyager salutes you. Absurd." },
] as const;

export function debriefFor(score: number) {
  return DEBRIEF_BANDS.find((b) => score >= b.min && score <= b.max) ?? DEBRIEF_BANDS[0];
}
