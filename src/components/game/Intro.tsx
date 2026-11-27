"use client";

import { Sprite } from "@/components/pixel/Sprite";
import { FLAME, LAUNCH_PAD, ROCKET } from "@/components/pixel/sprites";
import type { Logbook } from "@/lib/client/storage";
import { ANSWER_MS, PROMPTS_PER_DAY, TIERS, TIER_ORDER } from "@/lib/game/tiers";

interface Props {
  dayNumber: number;
  logbook: Logbook;
  resuming: boolean;
  onLaunch: () => void;
}

export function Intro({ dayNumber, logbook, resuming, onLaunch }: Props) {
  return (
    <div className="intro rise">
      <h1 className="intro__title">APOGEE</h1>
      <div className="intro__sub">THE DAILY LAUNCH</div>
      <p className="intro__line">
        {PROMPTS_PER_DAY} prompts · {ANSWER_MS / 1000} seconds each · rarer answers fly farther
      </p>

      <div className="intro__pad" aria-hidden>
        <Sprite def={LAUNCH_PAD} scale={5} />
        <div className="intro__rocket">
          <div className="bob">
            <Sprite def={ROCKET} scale={4} />
            <div className="intro__flame">
              <div className="flicker">
                <Sprite def={FLAME} scale={4} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <button type="button" className="btn btn--flame intro__launch" onClick={onLaunch}>
        ▲ {resuming ? "Resume flight" : "Launch"} ▲
      </button>

      <div className="intro__foot">
        <span className="eyebrow">Launch #{dayNumber}</span>
        {logbook.played > 0 && (
          <span className="eyebrow">
            streak {logbook.streak} · best {logbook.best}
          </span>
        )}
      </div>

      <details className="intro__how">
        <summary className="eyebrow">▸ How to play</summary>
        <div className="panel intro__how-body">
          <p>
            Every day, everyone gets the same <b>{PROMPTS_PER_DAY} prompts</b>. Each one says “Name a …”. You type{" "}
            <b>one</b> answer in {ANSWER_MS / 1000} seconds.
          </p>
          <p>
            Your answer is scored by how <b>rare</b> it is. The obvious pick barely leaves the pad. A deep cut puts you
            past the planets. Somewhere on every manifest there is one <b>apogee</b>: the answer that flies farthest.
          </p>
          <p>Spelling is forgiving. Made-up answers are not.</p>
          <div className="tierlist">
            {TIER_ORDER.map((id) => (
              <div key={id} style={{ display: "contents" }}>
                <span>{TIERS[id].emoji}</span>
                <span className="tierlist__name" style={{ color: TIERS[id].color }}>
                  {TIERS[id].name}
                </span>
                <span>{TIERS[id].score} pts</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
