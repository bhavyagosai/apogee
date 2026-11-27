import { formatKm, kmForScore } from "./milestones";
import { tierEmoji } from "./tiers";
import type { ResultTier } from "./types";

export const SITE_NAME = "APOGEE";
export const SITE_URL = "apogee.game";

export function shareText(dayNumber: number, score: number, tiers: ResultTier[]): string {
  const km = formatKm(kmForScore(score));
  return [`${SITE_NAME} #${dayNumber} · ${score} pts · ${km}`, tiers.map(tierEmoji).join(""), SITE_URL].join("\n");
}
