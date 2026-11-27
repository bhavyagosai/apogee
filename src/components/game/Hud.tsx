"use client";

import { formatKm, kmForScore, milestoneForScore } from "@/lib/game/milestones";
import { PROMPTS_PER_DAY, TIERS } from "@/lib/game/tiers";
import type { ResultTier } from "@/lib/game/types";

interface Props {
  score: number;
  /** Tiers of finished rounds, in order. */
  done: ResultTier[];
  /** 0-based index of the round in progress, or null between rounds. */
  current: number | null;
  label?: string;
}

export function Hud({ score, done, current, label }: Props) {
  const where = milestoneForScore(score);
  return (
    <div className="hud" role="status" aria-live="polite">
      <div className="panel hud__stat">
        <div className="eyebrow">Range</div>
        <div className="hud__value">{formatKm(kmForScore(score))}</div>
        <div className="hud__where">{where.label}</div>
      </div>
      <div className="hud__center">
        <div className="hud__dots" aria-hidden>
          {Array.from({ length: PROMPTS_PER_DAY }, (_, i) => {
            const t = done[i];
            const finished = i < done.length;
            const color = finished ? (t ? TIERS[t].color : "var(--tier-miss)") : undefined;
            return (
              <span
                key={i}
                className={`hud__dot ${finished ? "hud__dot--done" : ""} ${current === i ? "hud__dot--current blink" : ""}`}
                style={color ? ({ "--dot": color } as React.CSSProperties) : undefined}
              />
            );
          })}
        </div>
        <div className="eyebrow hud__prompt-no">
          {label ?? (current !== null ? `Prompt ${current + 1} of ${PROMPTS_PER_DAY}` : "")}
        </div>
      </div>
      <div className="panel hud__stat hud__stat--right">
        <div className="eyebrow">Score</div>
        <div className="hud__value hud__value--score">{score}</div>
      </div>
    </div>
  );
}
