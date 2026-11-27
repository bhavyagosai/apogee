import type { ResultTier } from "@/lib/game/types";

/** Everything the browser remembers, namespaced so a future reset is one prefix away. */
const KEY = {
  player: "apogee:player",
  run: "apogee:run",
  logbook: "apogee:logbook",
  sound: "apogee:sound",
  lastResult: "apogee:last-result",
} as const;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — the game still works for this session */
  }
}

function remove(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function newId(prefix: string): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${prefix}_${uuid.replace(/-/g, "")}`;
}

export function getPlayerId(): string {
  let id = read<string>(KEY.player);
  if (!id) {
    id = newId("pl");
    write(KEY.player, id);
  }
  return id;
}

export interface RoundRecord {
  promptId: string;
  answer: string;
  tier: ResultTier;
  score: number;
  receipt: string;
}

export interface SavedRun {
  date: string;
  runId: string;
  rounds: RoundRecord[];
  /** Set once the player has started answering prompt N (1-based); a reload mid-prompt counts as a timeout. */
  inFlight: number | null;
}

export function loadRun(date: string): SavedRun | null {
  const run = read<SavedRun>(KEY.run);
  return run && run.date === date ? run : null;
}

export function saveRun(run: SavedRun) {
  write(KEY.run, run);
}

export function clearRun() {
  remove(KEY.run);
}

export interface Logbook {
  streak: number;
  lastDate: string | null;
  played: number;
  best: number;
  total: number;
}

const EMPTY_LOGBOOK: Logbook = { streak: 0, lastDate: null, played: 0, best: 0, total: 0 };

export function loadLogbook(): Logbook {
  return read<Logbook>(KEY.logbook) ?? EMPTY_LOGBOOK;
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** Records a completed flight exactly once per date. */
export function recordFlight(date: string, score: number): Logbook {
  const book = loadLogbook();
  if (book.lastDate === date) return book;
  const streak = book.lastDate && daysBetween(book.lastDate, date) === 1 ? book.streak + 1 : 1;
  const next: Logbook = {
    streak,
    lastDate: date,
    played: book.played + 1,
    best: Math.max(book.best, score),
    total: book.total + score,
  };
  write(KEY.logbook, next);
  return next;
}

export function loadSoundOn(): boolean {
  return read<boolean>(KEY.sound) ?? true;
}

export function saveSoundOn(on: boolean) {
  write(KEY.sound, on);
}

/** The debrief payload for today, so a refresh after finishing shows it again without re-posting. */
export function loadLastResult<T extends { date: string }>(date: string): T | null {
  const r = read<T>(KEY.lastResult);
  return r && r.date === date ? r : null;
}

export function saveLastResult<T extends { date: string }>(result: T) {
  write(KEY.lastResult, result);
}
