/** Day #1 is the first scheduled launch. Days roll over at 00:00 UTC. */
export const EPOCH = "2026-11-26";

const DAY_MS = 86_400_000;

export function utcDateString(d: Date = new Date()): string {
  // Dev-only: pin "today" to any content file, e.g. APOGEE_DATE=2000-01-01 pnpm dev
  if (process.env.NODE_ENV !== "production" && process.env.APOGEE_DATE) return process.env.APOGEE_DATE;
  return d.toISOString().slice(0, 10);
}

export function dayNumberFor(date: string): number {
  return Math.round((Date.parse(date) - Date.parse(EPOCH)) / DAY_MS) + 1;
}

export function resetsAtFor(date: string): string {
  return new Date(Date.parse(date) + DAY_MS).toISOString();
}

export function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
