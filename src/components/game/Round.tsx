"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/client/sound";
import { ANSWER_MS, MAX_ANSWER_LENGTH, PREVIEW_MS, PROMPTS_PER_DAY } from "@/lib/game/tiers";
import type { PublicPrompt } from "@/lib/game/types";

interface Props {
  prompt: PublicPrompt;
  index: number;
  /** Absolute time the answer window opened, or null during the preview countdown. */
  startedAt: number | null;
  busy: boolean;
  /** Answers already rejected this round; a new one resets the input for another go. */
  misses: string[];
  onReady: () => void;
  onSubmit: (text: string) => void;
  onTimeout: () => void;
}

export function Round({ prompt, index, startedAt, busy, misses, onReady, onSubmit, onTimeout }: Props) {
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);
  /** Guards against a submit and a timeout both landing; reopened whenever grading hands the round back. */
  const firedRef = useRef(false);
  useEffect(() => {
    if (!busy) firedRef.current = false;
  }, [busy]);

  // A rejected answer hands the input back: clear it for another shot.
  const missCount = misses.length;
  const [seenMisses, setSeenMisses] = useState(0);
  if (missCount !== seenMisses) {
    setSeenMisses(missCount);
    setText("");
  }
  const lastWarnRef = useRef(-1);

  // Preview countdown: T-3, T-2, T-1, then the window opens.
  const [previewStart] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt !== null) return;
    const t = setTimeout(onReady, PREVIEW_MS);
    return () => clearTimeout(t);
  }, [startedAt, onReady]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (startedAt !== null) inputRef.current?.focus();
  }, [startedAt]);


  const remaining = startedAt === null ? ANSWER_MS : Math.max(0, startedAt + ANSWER_MS - now);
  const seconds = Math.ceil(remaining / 1000);

  // The clock: fires once at the deadline. If a miss comes back after the
  // deadline, busy flips false and this re-arms with zero delay.
  useEffect(() => {
    if (startedAt === null || busy) return;
    const t = setTimeout(
      () => {
        if (firedRef.current) return;
        firedRef.current = true;
        onTimeout();
      },
      Math.max(0, startedAt + ANSWER_MS - Date.now()),
    );
    return () => clearTimeout(t);
  }, [startedAt, busy, onTimeout]);

  useEffect(() => {
    if (startedAt === null || busy) return;
    if (seconds <= 5 && seconds !== lastWarnRef.current) {
      lastWarnRef.current = seconds;
      sfx.warn();
    }
  }, [seconds, startedAt, busy]);

  const previewSeconds = Math.max(1, Math.ceil((PREVIEW_MS - (now - previewStart)) / 1000));
  const frac = remaining / ANSWER_MS;
  const r = 26;
  const circ = 2 * Math.PI * r;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy || firedRef.current) return;
    firedRef.current = true;
    onSubmit(v);
  }

  return (
    <div className="round rise" key={prompt.id}>
      <div className="panel prompt">
        <div className="eyebrow">
          Prompt {index + 1} of {PROMPTS_PER_DAY}
        </div>
        <h2 className="prompt__text">{prompt.text}</h2>
        <div className="prompt__hint">▲ rarer answers fly farther ▲</div>
      </div>

      {missCount > 0 && startedAt !== null && (
        <div className="miss rise" role="status" aria-live="polite" key={`miss-${missCount}`}>
          {`“${misses[missCount - 1]}” isn't on the manifest — try another`}
        </div>
      )}

      {startedAt === null ? (
        <div className="countdown" aria-live="assertive">
          T-{previewSeconds}
        </div>
      ) : (
        <form key={missCount} className={`answer ${missCount > 0 ? "shake" : ""}`} onSubmit={submit}>
          <div className={`timer ${seconds <= 5 ? "timer--low" : ""}`} aria-hidden>
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
              <circle
                cx="32"
                cy="32"
                r={r}
                fill="none"
                stroke={seconds <= 5 ? "var(--flame)" : "var(--ice)"}
                strokeWidth="5"
                strokeDasharray={circ}
                strokeDashoffset={circ * (1 - frac)}
                style={{ transition: "stroke-dashoffset 100ms linear" }}
              />
            </svg>
            <div className="timer__num">{seconds}</div>
          </div>
          <input
            ref={inputRef}
            id="answer"
            name="answer"
            autoFocus
            className="input"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_ANSWER_LENGTH))}
            placeholder="type one answer…"
            aria-label="Your answer"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            disabled={busy}
          />
          <button type="submit" className="btn btn--flame answer__fire" disabled={!text.trim() || busy}>
            {busy ? "…" : "Fire"}
          </button>
        </form>
      )}
    </div>
  );
}
