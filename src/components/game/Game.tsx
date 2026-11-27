"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "@/lib/client/api";
import { setSoundEnabled, sfx } from "@/lib/client/sound";
import {
  clearRun,
  getPlayerId,
  loadLastResult,
  loadLogbook,
  loadRun,
  loadSoundOn,
  newId,
  recordFlight,
  saveLastResult,
  saveRun,
  saveSoundOn,
  type Logbook,
  type RoundRecord,
  type SavedRun,
} from "@/lib/client/storage";
import { PROMPTS_PER_DAY } from "@/lib/game/tiers";
import type { CompleteResponse, TodayResponse } from "@/lib/game/types";
import { Debrief } from "./Debrief";
import { Hud } from "./Hud";
import { Intro } from "./Intro";
import { Reveal } from "./Reveal";
import { Round } from "./Round";
import { Sky } from "./Sky";
import "./game.css";

type Phase =
  | { kind: "loading" }
  | { kind: "unavailable"; message: string }
  | { kind: "intro" }
  | { kind: "round"; index: number; startedAt: number | null; busy: boolean; misses: string[] }
  | { kind: "reveal"; index: number; typed: string; quip?: string }
  | { kind: "completing" }
  | { kind: "debrief"; result: CompleteResponse; proof: string }
  | { kind: "error"; message: string };

const EMPTY_LOGBOOK: Logbook = { streak: 0, lastDate: null, played: 0, best: 0, total: 0 };

export function Game() {
  const [today, setToday] = useState<TodayResponse | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [run, setRun] = useState<SavedRun | null>(null);
  const [logbook, setLogbook] = useState<Logbook>(EMPTY_LOGBOOK);
  const [soundOn, setSoundOn] = useState(true);
  const playerId = useRef<string>("");

  const score = run ? run.rounds.reduce((s, r) => s + r.score, 0) : 0;
  const doneTiers = run ? run.rounds.map((r) => r.tier) : [];

  // Boot: who am I, what day is it, is there a flight to resume?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Browser-only state is read here rather than in initial state so SSR and hydration agree.
      playerId.current = getPlayerId();
      const on = loadSoundOn();
      setSoundOn(on);
      setSoundEnabled(on);
      setLogbook(loadLogbook());
      try {
        const t = await api.today();
        if (cancelled) return;
        setToday(t);
        const last = loadLastResult<CompleteResponse & { proof?: string }>(t.date);
        if (last) {
          setPhase({ kind: "debrief", result: last, proof: last.proof ?? "" });
          return;
        }
        const saved = loadRun(t.date);
        if (saved) setRun(saved);
        setPhase({ kind: "intro" });
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof ApiError && e.status === 404
            ? "No launch scheduled yet. Check back soon."
            : "Mission control isn't answering. Try again in a moment.";
        setPhase({ kind: "unavailable", message: msg });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function persist(next: SavedRun) {
    setRun(next);
    saveRun(next);
  }

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    saveSoundOn(next);
    setSoundEnabled(next);
  }

  /** Grades one answer ("" = timed out) and moves to its reveal. */
  async function grade(current: SavedRun, index: number, text: string) {
    if (!today) return;
    const promptId = `p${index + 1}`;
    setPhase((p) =>
      p.kind === "round" ? { ...p, busy: true } : { kind: "round", index, startedAt: Date.now(), busy: true, misses: [] },
    );
    try {
      const res = await api.submit({
        date: today.date,
        playerId: playerId.current,
        runId: current.runId,
        promptId,
        answer: text,
      });
      if (!res.accepted && text !== "") {
        // Not on the manifest: back to the input, clock still running.
        sfx.miss();
        setPhase((p) => (p.kind === "round" ? { ...p, busy: false, misses: [...p.misses, text] } : p));
        return;
      }
      if (!res.receipt) throw new Error("Mission control sent no receipt.");
      const record: RoundRecord = {
        promptId,
        answer: res.accepted ? res.answer : text,
        tier: res.tier,
        score: res.score,
        receipt: res.receipt,
      };
      persist({ ...current, rounds: [...current.rounds, record], inFlight: null });
      setPhase({ kind: "reveal", index, typed: text, quip: res.quip });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  }

  async function finish(current: SavedRun) {
    if (!today) return;
    setPhase({ kind: "completing" });
    try {
      const result = await api.complete({
        date: today.date,
        playerId: playerId.current,
        runId: current.runId,
        receipts: current.rounds.map((r) => r.receipt),
      });
      const proof = current.rounds[PROMPTS_PER_DAY - 1].receipt;
      setLogbook(recordFlight(today.date, result.score));
      saveLastResult({ ...result, proof });
      clearRun();
      setPhase({ kind: "debrief", result, proof });
    } catch (e) {
      setPhase({ kind: "error", message: (e as Error).message });
    }
  }

  function startRound(current: SavedRun, index: number) {
    sfx.stage();
    setPhase({ kind: "round", index, startedAt: null, busy: false, misses: [] });
    // Reaching the answer window is the point of no return for this prompt.
    persist({ ...current, inFlight: index + 1 });
  }

  function launch() {
    if (!today) return;
    sfx.ignition();
    let current = run;
    if (!current) {
      current = { date: today.date, runId: newId("run"), rounds: [], inFlight: null };
      persist(current);
    }
    const index = current.rounds.length;
    if (index >= PROMPTS_PER_DAY) {
      void finish(current);
      return;
    }
    if (current.inFlight === index + 1) {
      // Reloaded mid-answer: the countdown wins.
      void grade(current, index, "");
      return;
    }
    startRound(current, index);
  }

  function next() {
    if (!run) return;
    const index = run.rounds.length;
    if (index >= PROMPTS_PER_DAY) void finish(run);
    else startRound(run, index);
  }

  function onReady() {
    setPhase((p) => (p.kind === "round" && p.startedAt === null ? { ...p, startedAt: Date.now() } : p));
  }

  function onSubmit(text: string) {
    if (!run || phase.kind !== "round") return;
    sfx.submit();
    void grade(run, phase.index, text);
  }

  function onTimeout() {
    if (!run || phase.kind !== "round") return;
    void grade(run, phase.index, "");
  }

  const inGame = phase.kind === "round" || phase.kind === "reveal" || phase.kind === "completing";
  const skyScore = phase.kind === "debrief" ? phase.result.score : inGame ? score : 0;

  return (
    <>
      <Sky score={skyScore} grounded={!inGame && phase.kind !== "debrief"} dim={phase.kind === "reveal" || phase.kind === "debrief"} />
      <div className="shell">
        {inGame && today && (
          <Hud
            score={score}
            done={doneTiers}
            current={phase.kind === "round" ? phase.index : null}
            label={phase.kind === "reveal" ? `Prompt ${phase.index + 1} of ${PROMPTS_PER_DAY}` : undefined}
          />
        )}
        <div className="topbar" style={{ marginTop: inGame ? 10 : 0 }}>
          <span className="eyebrow">{today && phase.kind !== "intro" ? `Launch #${today.dayNumber}` : ""}</span>
          <button
            type="button"
            className="iconbtn"
            onClick={toggleSound}
            aria-label={soundOn ? "turn sound off" : "turn sound on"}
          >
            {soundOn ? "♪" : "✕"}
          </button>
        </div>

        <main className="shell__main">
          {phase.kind === "loading" && <div className="notice blink">contacting mission control…</div>}
          {phase.kind === "unavailable" && (
            <div className="panel notice">
              <b>APOGEE</b>
              <br />
              {phase.message}
            </div>
          )}
          {phase.kind === "intro" && today && (
            <Intro
              dayNumber={today.dayNumber}
              logbook={logbook}
              resuming={!!run && run.rounds.length > 0}
              onLaunch={launch}
            />
          )}
          {phase.kind === "round" && today && (
            <Round
              key={phase.index}
              prompt={today.prompts[phase.index]}
              index={phase.index}
              startedAt={phase.startedAt}
              busy={phase.busy}
              misses={phase.misses}
              onReady={onReady}
              onSubmit={onSubmit}
              onTimeout={onTimeout}
            />
          )}
          {phase.kind === "reveal" && run && (
            <Reveal
              key={phase.index}
              result={run.rounds[phase.index]}
              typed={phase.typed}
              quip={phase.quip}
              prevScore={score - run.rounds[phase.index].score}
              isLast={phase.index === PROMPTS_PER_DAY - 1}
              onNext={next}
            />
          )}
          {phase.kind === "completing" && <div className="notice blink">logging the flight…</div>}
          {phase.kind === "debrief" && today && (
            <Debrief result={phase.result} logbook={logbook} resetsAt={today.resetsAt} proof={phase.proof} />
          )}
          {phase.kind === "error" && (
            <div className="panel notice">
              <b>Signal lost.</b>
              <br />
              {phase.message}
              <br />
              <br />
              <button type="button" className="btn btn--ghost" onClick={() => window.location.reload()}>
                Reconnect
              </button>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
