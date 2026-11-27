"use client";

import { useMemo } from "react";
import { Sprite } from "@/components/pixel/Sprite";
import { FLAME, JUPITER, LAUNCH_PAD, MARS, MOON, NEPTUNE, ROCKET, SATURN } from "@/components/pixel/sprites";
import { MILESTONES } from "@/lib/game/milestones";
import { MAX_SCORE } from "@/lib/game/tiers";

/** Vertical pixels per score point — the whole climb is MAX_SCORE × this tall. */
export const PX_PER_POINT = 14;

const SKY_STOPS: [number, string][] = [
  // A dusk launch: dark enough for the HUD to read, light enough to feel like sky.
  [0, "#2d5e9c"],
  [30, "#234b84"],
  [60, "#193766"],
  [85, "#10244a"],
  [100, "#0b1838"],
  [130, "#05091c"],
  [200, "#02040a"],
];

function hex(c: string): [number, number, number] {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

export function skyColor(score: number): string {
  const s = Math.max(0, score);
  for (let i = 1; i < SKY_STOPS.length; i++) {
    const [a, ca] = SKY_STOPS[i - 1];
    const [b, cb] = SKY_STOPS[i];
    if (s <= b) {
      const t = (s - a) / (b - a);
      const [r1, g1, b1] = hex(ca);
      const [r2, g2, b2] = hex(cb);
      return `rgb(${Math.round(r1 + (r2 - r1) * t)}, ${Math.round(g1 + (g2 - g1) * t)}, ${Math.round(b1 + (b2 - b1) * t)})`;
    }
  }
  return SKY_STOPS[SKY_STOPS.length - 1][1];
}

function starOpacity(score: number): number {
  return Math.max(0, Math.min(1, (score - 50) / 60));
}

/** Deterministic starfield so SSR and the client agree. */
function stars(n: number) {
  let seed = 1337;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rnd() * 100,
    y: rnd() * 100,
    big: rnd() > 0.88,
    o: 0.35 + rnd() * 0.65,
  }));
}

const BODIES: { at: number; node: React.ReactNode }[] = [
  { at: 270, node: <Sprite def={MOON} scale={5} /> },
  { at: 360, node: <Sprite def={MARS} scale={4} /> },
  { at: 440, node: <Sprite def={JUPITER} scale={6} /> },
  { at: 480, node: <Sprite def={SATURN} scale={5} /> },
  { at: 560, node: <Sprite def={NEPTUNE} scale={4} /> },
];

/**
 * Near the pad the camera sits low so the ground is a strip, not half the
 * screen; it eases up to the normal framing over the first few points.
 */
function cameraLift(score: number, grounded?: boolean): number {
  if (grounded) return 34;
  return Math.max(0, Math.round(30 - score / 2));
}

interface Props {
  score: number;
  /** On the intro the rocket sits on the pad rather than at the marker. */
  grounded?: boolean;
  /** A card is covering the middle of the screen; fade the world a little. */
  dim?: boolean;
}

export function Sky({ score, grounded, dim }: Props) {
  const field = useMemo(() => stars(90), []);
  const y = (at: number) => -at * PX_PER_POINT;

  return (
    <>
      <div className={`sky ${grounded ? "sky--grounded" : ""} ${dim ? "sky--dim" : ""}`} style={{ backgroundColor: skyColor(score) }} aria-hidden>
        <div className="sky__stars" style={{ opacity: starOpacity(score) }}>
          {field.map((s) => (
            <span
              key={s.id}
              className={`sky__star ${s.big ? "sky__star--big" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%`, opacity: s.o }}
            />
          ))}
        </div>

        <div
          className="sky__world"
          style={{ transform: `translateY(calc(${score * PX_PER_POINT}px + ${cameraLift(score, grounded)}vh))` }}
        >
          <div className="sky__ruler" />
          {Array.from({ length: MAX_SCORE / 10 + 1 }, (_, i) => i * 10).map((at) => (
            <span
              key={at}
              className={`sky__tick ${at % 50 === 0 ? "sky__tick--major" : ""}`}
              style={{ top: y(at) }}
            />
          ))}
          {MILESTONES.filter((m) => m.at > 0).map((m) => (
            <span key={m.at} className={`sky__label ${m.zone ? "sky__label--zone" : ""}`} style={{ top: y(m.at) }}>
              {m.label}
            </span>
          ))}
          {BODIES.map((b) => (
            <div key={b.at} className="sky__body" style={{ top: y(b.at) - 40 }}>
              {b.node}
            </div>
          ))}
          <div className="sky__ground" style={{ top: 70 }}>
            {!grounded && (
              <div className="sky__pad">
                <Sprite def={LAUNCH_PAD} scale={4} />
              </div>
            )}
          </div>
        </div>
      </div>

      {!grounded && (
        <div
          className={`sky__you ${dim ? "sky__you--dim" : ""}`}
          style={{ top: `calc(44% + ${cameraLift(score, grounded)}vh)` }}
          aria-hidden
        >
          <span className="sky__you-tag">YOU ▶</span>
          <div className="sky__rocket">
            <Sprite def={ROCKET} scale={3} />
            <div className="sky__flame">
              <div className="flicker">
                <Sprite def={FLAME} scale={3} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
