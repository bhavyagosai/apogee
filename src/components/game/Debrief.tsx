"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Logbook } from "@/lib/client/storage";
import { formatKm, kmForScore, milestoneForScore } from "@/lib/game/milestones";
import { shareText } from "@/lib/game/share";
import { DEBRIEF_BANDS, MISS, TIERS, TIER_ORDER, debriefFor } from "@/lib/game/tiers";
import type { CompleteResponse, PromptContent, ResultTier, TierId } from "@/lib/game/types";

interface Props {
  result: CompleteResponse;
  logbook: Logbook;
  resetsAt: string;
  /** Receipt for prompt 7 — unlocks today's manifest. */
  proof: string;
}

function countdown(to: string, now: number): string {
  const ms = Math.max(0, Date.parse(to) - now);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function colorFor(tier: ResultTier): string {
  return tier ? TIERS[tier].color : MISS.color;
}

export function Debrief({ result, logbook, resetsAt, proof }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  const [manifest, setManifest] = useState<PromptContent[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function toggle(promptId: string) {
    if (open === promptId) {
      setOpen(null);
      return;
    }
    setOpen(promptId);
    if (!manifest && !loadError) {
      try {
        const r = await api.reveal(result.date, proof);
        setManifest(r.prompts);
      } catch (e) {
        setLoadError((e as Error).message);
      }
    }
  }

  const text = shareText(
    result.dayNumber,
    result.score,
    result.rounds.map((r) => r.tier),
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked; the share button still works */
    }
  }

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        /* dismissed */
      }
    } else {
      void copy();
    }
  }

  const band = debriefFor(result.score);
  const where = milestoneForScore(result.score);
  const best = Math.max(1, ...result.rounds.map((r) => r.score));

  return (
    <div className="debrief rise">
      <div className="panel debrief__hero">
        <div className="eyebrow">Launch #{result.dayNumber} complete</div>
        <div className="debrief__score">{result.score}</div>
        <div className="debrief__range">{formatKm(kmForScore(result.score))}</div>
        <div className="hud__where" style={{ maxWidth: "none" }}>
          {where.label}
        </div>
        <div className="debrief__better">
          {result.totalRuns > 1 ? (
            <>
              BETTER THAN <span style={{ color: "var(--flame)" }}>{result.betterThan}%</span> OF TODAY&apos;S PILOTS
            </>
          ) : (
            <>FIRST PILOT UP TODAY</>
          )}
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={copy}>
          {copied ? "Copied ✓" : "Copy result"}
        </button>
        <button type="button" className="btn btn--flame" onClick={share}>
          Share…
        </button>
      </div>

      <section className="panel section">
        <div className="section__title">
          <h2>Flight log</h2>
          <span className="eyebrow">higher = rarer</span>
        </div>
        <div className="flightlog">
          {result.rounds.map((r, i) => (
            <div key={r.promptId} className="flightlog__bar" title={`${r.answer || "—"} · ${r.score} pts`}>
              <div
                className="flightlog__fill"
                style={
                  {
                    "--bar": colorFor(r.tier),
                    height: `${Math.max(3, (r.score / best) * 100)}%`,
                    animationDelay: `${i * 70}ms`,
                  } as React.CSSProperties
                }
              />
              <div className="flightlog__idx">{i + 1}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel section">
        <div className="section__title">
          <h2>The debrief</h2>
          <span className="eyebrow">{band.name}</span>
        </div>
        <div className="bands">
          {DEBRIEF_BANDS.map((b) => (
            <div key={b.name} className={`band ${b === band ? "band--you" : ""}`}>
              <b>
                {b.min}
                {b.max === Infinity ? "+" : `–${b.max}`}
              </b>
              <span>
                {b.name}. {b.line}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="panel section">
        <div className="section__title">
          <h2>The manifest</h2>
          <span className="eyebrow">tap a round for every answer</span>
        </div>
        <div className="manifest">
          {result.rounds.map((r, i) => {
            const prompt = manifest?.find((p) => p.id === r.promptId);
            const isOpen = open === r.promptId;
            return (
              <div key={r.promptId} className="mrow" style={{ "--ans": colorFor(r.tier) } as React.CSSProperties}>
                <button type="button" className="mrow__head" onClick={() => toggle(r.promptId)} aria-expanded={isOpen}>
                  <span className="mrow__n">{i + 1}</span>
                  <span>
                    <div className="mrow__q">{r.text}</div>
                    <div className="mrow__a">{r.answer || "—"}</div>
                    {r.tier && (
                      <div className="mrow__others">
                        {r.others === 0
                          ? "nobody else picked this today"
                          : `${r.others.toLocaleString()} other ${r.others === 1 ? "pilot" : "pilots"} chose this`}
                      </div>
                    )}
                  </span>
                  <span className="mrow__pts">{r.score}</span>
                </button>
                {isOpen && (
                  <div className="mrow__body">
                    {loadError && <div className="notice">{loadError}</div>}
                    {!prompt && !loadError && <div className="notice blink">reading the manifest…</div>}
                    {prompt && <ManifestList prompt={prompt} mine={r.answer} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel section">
        <div className="logbook">
          <span>
            streak <b>{logbook.streak}</b>
          </span>
          <span>
            flights <b>{logbook.played}</b>
          </span>
          <span>
            avg <b>{logbook.played ? Math.round(logbook.total / logbook.played) : 0}</b>
          </span>
          <span>
            best <b>{logbook.best}</b>
          </span>
        </div>
      </section>

      <div className="nextlaunch">
        NEXT LAUNCH IN <b>{countdown(resetsAt, now)}</b>
      </div>
    </div>
  );
}

const PREVIEW_COUNT: Record<TierId, number> = { paper: 100, balloon: 100, jet: 100, orbit: 60, deep: 24, apogee: 1 };

function ManifestList({ prompt, mine }: { prompt: PromptContent; mine: string }) {
  const [expanded, setExpanded] = useState<Set<TierId>>(new Set());
  const groups = [...TIER_ORDER].reverse().map((t) => ({ tier: t, items: prompt.answers.filter((a) => a.tier === t) }));
  return (
    <>
      {groups
        .filter((g) => g.items.length)
        .map((g) => {
          const def = TIERS[g.tier];
          const showAll = expanded.has(g.tier);
          const items = showAll ? g.items : g.items.slice(0, PREVIEW_COUNT[g.tier]);
          return (
            <div key={g.tier} className="tiergroup" style={{ "--t": def.color } as React.CSSProperties}>
              <div className="tiergroup__h">
                <span>
                  {def.emoji} {def.name}
                </span>
                <span>
                  {g.items.length} · {def.score} pts
                </span>
              </div>
              <div className="tiergroup__list">
                {items.map((a, i) => (
                  <span key={a.answer}>
                    <span className={a.answer === mine ? "mine" : ""}>{a.answer}</span>
                    {a.quip && <em> — {a.quip}</em>}
                    {i < items.length - 1 ? ", " : ""}
                  </span>
                ))}
                {!showAll && g.items.length > items.length && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="tiergroup__more"
                      onClick={() => setExpanded(new Set([...expanded, g.tier]))}
                    >
                      +{g.items.length - items.length} more
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
    </>
  );
}
