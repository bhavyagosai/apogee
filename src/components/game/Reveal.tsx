"use client";

import { useEffect, useState } from "react";
import { Sprite } from "@/components/pixel/Sprite";
import { SCRUBBED, TIER_SPRITES } from "@/components/pixel/sprites";
import { sfx } from "@/lib/client/sound";
import type { RoundRecord } from "@/lib/client/storage";
import { formatKm, kmForScore } from "@/lib/game/milestones";
import { MISS, TIERS, TIER_ORDER } from "@/lib/game/tiers";

interface Props {
  result: RoundRecord;
  /** What the player actually typed (may differ from the canonical answer). */
  typed: string;
  quip?: string;
  /** Score before this round landed. */
  prevScore: number;
  isLast: boolean;
  onNext: () => void;
}

const RUNG_MS = 170;

export function Reveal({ result, typed, quip, prevScore, isLast, onNext }: Props) {
  const tier = result.tier;
  const landedIdx = tier ? TIER_ORDER.indexOf(tier) : -1;
  // Marker climbs the ladder one rung at a time, then the card appears.
  const [lit, setLit] = useState(-1);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (landedIdx < 0) {
      const t = setTimeout(() => {
        setLanded(true);
        sfx.reveal(null);
      }, 500);
      return () => clearTimeout(t);
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i <= landedIdx; i++) {
      timers.push(
        setTimeout(() => {
          setLit(i);
          sfx.tick();
        }, 200 + i * RUNG_MS),
      );
    }
    timers.push(
      setTimeout(() => {
        setLanded(true);
        sfx.reveal(tier);
      }, 200 + (landedIdx + 1) * RUNG_MS + 150),
    );
    return () => timers.forEach(clearTimeout);
  }, [landedIdx, tier]);

  const def = tier ? TIERS[tier] : null;
  const color = def ? def.color : MISS.color;
  const climb = kmForScore(prevScore + result.score) - kmForScore(prevScore);
  const timedOut = !tier && typed === "";

  return (
    <div className="reveal" style={{ "--tier": color } as React.CSSProperties}>
      {!landed && (
        <div className={`ladder ${landedIdx < 0 ? "shake" : ""}`} aria-hidden>
          {TIER_ORDER.map((id, i) => (
            <div
              key={id}
              className={`ladder__rung ${i <= lit ? "ladder__rung--lit" : ""}`}
              style={{ "--rung": TIERS[id].color } as React.CSSProperties}
            >
              <span>{TIERS[id].name}</span>
              <span>{TIERS[id].score}</span>
            </div>
          ))}
        </div>
      )}

      {landed && (
        <div className="reveal__card rise" role="status" aria-live="assertive">
          <div className="glow" style={{ "--glow": color } as React.CSSProperties}>
            <Sprite def={tier ? TIER_SPRITES[tier] : SCRUBBED} scale={6} />
          </div>
          <div className="reveal__tier">{def ? def.name : MISS.name}</div>
          <div className="reveal__answer">{timedOut ? "—" : `“${result.answer}”`}</div>
          {!timedOut && tier && typed.trim().toLowerCase() !== result.answer.toLowerCase() && (
            <div className="reveal__answer--typed">you typed “{typed}”</div>
          )}
          <div className="reveal__pts">
            <b>+{result.score} PTS</b>
            {result.score > 0 && <> · ↑ {formatKm(climb)}</>}
          </div>
          <div className="reveal__blurb">{def ? def.blurb : timedOut ? MISS.timeoutBlurb : MISS.blurb}</div>
          {tier === "apogee" && quip && <div className="reveal__quip">{quip}</div>}
        </div>
      )}

      <button type="button" className="btn reveal__next" onClick={onNext} disabled={!landed}>
        {isLast ? "Touchdown →" : "Next stage ▲"}
      </button>
    </div>
  );
}
