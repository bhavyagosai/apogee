/**
 * Canonical key for matching player input against the manifest.
 * Generous on purpose: case, accents, punctuation, "the", and "&" all fold away.
 */
export function normalize(input: string): string {
  let s = input.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = s.toLowerCase();
  s = s.replace(/&/g, " and ");
  s = s.replace(/[’'`]/g, "");
  s = s.replace(/[^a-z0-9]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^(the|a|an) /, "");
  return s;
}

/**
 * Optimal string alignment distance (Levenshtein + adjacent transposition),
 * bailing out early once the distance exceeds `max`.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const la = a.length;
  const lb = b.length;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur: number[] = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb];
}

/** How many typos we forgive for a key of this length. */
export function toleranceFor(key: string): number {
  if (key.length < 4) return 0;
  if (key.length < 7) return 1;
  return 2;
}
