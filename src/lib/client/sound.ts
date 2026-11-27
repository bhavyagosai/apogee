import type { ResultTier } from "@/lib/game/types";

/**
 * Tiny synthesised sound effects — square waves through WebAudio, no assets.
 * Everything is a no-op until `enable()` runs from a user gesture.
 */
let ctx: AudioContext | null = null;
let enabled = true;

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (on) ac();
}

interface Note {
  freq: number;
  at: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
}

function play(notes: Note[]) {
  if (!enabled) return;
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  for (const n of notes) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = n.type ?? "square";
    osc.frequency.setValueAtTime(n.freq, t0 + n.at);
    const peak = n.gain ?? 0.06;
    g.gain.setValueAtTime(0.0001, t0 + n.at);
    g.gain.exponentialRampToValueAtTime(peak, t0 + n.at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
    osc.connect(g).connect(c.destination);
    osc.start(t0 + n.at);
    osc.stop(t0 + n.at + n.dur + 0.02);
  }
}

export const sfx = {
  tick() {
    play([{ freq: 880, at: 0, dur: 0.04, gain: 0.03 }]);
  },
  ignition() {
    play([
      { freq: 110, at: 0, dur: 0.25, type: "sawtooth", gain: 0.05 },
      { freq: 220, at: 0.1, dur: 0.3, type: "sawtooth", gain: 0.05 },
      { freq: 440, at: 0.25, dur: 0.35, type: "sawtooth", gain: 0.04 },
    ]);
  },
  submit() {
    play([
      { freq: 523, at: 0, dur: 0.06 },
      { freq: 784, at: 0.06, dur: 0.08 },
    ]);
  },
  reveal(tier: ResultTier) {
    if (!tier) {
      play([
        { freq: 196, at: 0, dur: 0.18, type: "sawtooth" },
        { freq: 147, at: 0.18, dur: 0.3, type: "sawtooth" },
      ]);
      return;
    }
    const steps = { paper: 1, balloon: 2, jet: 3, orbit: 4, deep: 5, apogee: 7 }[tier];
    const base = 392;
    const notes: Note[] = [];
    for (let i = 0; i < steps; i++) {
      notes.push({ freq: base * Math.pow(2, i / 5), at: i * 0.07, dur: 0.12 });
    }
    if (tier === "apogee") {
      notes.push({ freq: 1568, at: steps * 0.07, dur: 0.5, type: "triangle", gain: 0.08 });
    }
    play(notes);
  },
  stage() {
    play([{ freq: 330, at: 0, dur: 0.05 }, { freq: 440, at: 0.05, dur: 0.07 }]);
  },
  warn() {
    play([{ freq: 1047, at: 0, dur: 0.05, gain: 0.04 }]);
  },
  miss() {
    play([
      { freq: 220, at: 0, dur: 0.08, type: "sawtooth", gain: 0.05 },
      { freq: 165, at: 0.08, dur: 0.14, type: "sawtooth", gain: 0.05 },
    ]);
  },
};
