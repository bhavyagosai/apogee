import { MAX_SCORE } from "./tiers";

/**
 * Real places along the climb, placed on the 0–700 score track.
 * `km` is the true distance from Earth's surface; the track between
 * milestones is interpolated in log space so the readout accelerates
 * the way a launch feels.
 */
export interface Milestone {
  at: number;
  km: number;
  label: string;
  /** Big zone headers get a heavier treatment on the ruler. */
  zone?: boolean;
}

export const MILESTONES: Milestone[] = [
  { at: 0, km: 0, label: "T-minus zero" },
  { at: 10, km: 0.83, label: "the Burj Khalifa — 0.83 km. cleared it" },
  { at: 20, km: 8.8, label: "Everest's summit — 8.8 km" },
  { at: 30, km: 12, label: "airliners cruise here — 12 km" },
  { at: 45, km: 20, label: "THE STRATOSPHERE — the ozone lives here", zone: true },
  { at: 60, km: 39, label: "Baumgartner jumped from here — 39 km" },
  { at: 75, km: 50, label: "the sky turns black. no more blue" },
  { at: 100, km: 100, label: "THE KÁRMÁN LINE — space begins — 100 km", zone: true },
  { at: 120, km: 160, label: "the lowest stable orbit — 160 km" },
  { at: 140, km: 400, label: "the ISS orbits here — 400 km" },
  { at: 165, km: 540, label: "Hubble stares out from here — 540 km" },
  { at: 190, km: 2_000, label: "the Van Allen belts — radiation country" },
  { at: 215, km: 20_200, label: "GPS satellites — 20,200 km" },
  { at: 240, km: 35_786, label: "geostationary orbit — 35,786 km" },
  { at: 270, km: 384_400, label: "THE MOON — 384,400 km. twelve people have stood here", zone: true },
  { at: 300, km: 1_500_000, label: "L2 — the Webb telescope's parking spot" },
  { at: 330, km: 41_000_000, label: "Venus at its closest — 41M km" },
  { at: 360, km: 55_000_000, label: "MARS — rovers, no people. yet", zone: true },
  { at: 400, km: 300_000_000, label: "THE ASTEROID BELT — mind the rocks", zone: true },
  { at: 440, km: 588_000_000, label: "JUPITER — 1,300 Earths would fit inside" },
  { at: 480, km: 1_200_000_000, label: "SATURN — the rings are mostly water ice" },
  { at: 520, km: 2_600_000_000, label: "Uranus — rolls on its side" },
  { at: 560, km: 4_300_000_000, label: "NEPTUNE — winds of 2,000 km/h" },
  { at: 600, km: 5_900_000_000, label: "Pluto. still counts to us" },
  { at: 640, km: 18_000_000_000, label: "THE HELIOPAUSE — the Sun's wind gives up", zone: true },
  { at: 670, km: 24_000_000_000, label: "VOYAGER 1 — the farthest human-made thing" },
  { at: MAX_SCORE, km: 30_000_000_000, label: "APOGEE — a perfect flight ends here", zone: true },
];

/** Distance from the surface, in km, for a cumulative score on the track. */
export function kmForScore(score: number): number {
  const s = Math.max(0, Math.min(MAX_SCORE, score));
  for (let i = 1; i < MILESTONES.length; i++) {
    const a = MILESTONES[i - 1];
    const b = MILESTONES[i];
    if (s <= b.at) {
      if (s === b.at) return b.km;
      const t = (s - a.at) / (b.at - a.at);
      // First segment starts at 0 km, which log space can't hold.
      if (a.km <= 0) return b.km * t;
      return Math.exp(Math.log(a.km) + (Math.log(b.km) - Math.log(a.km)) * t);
    }
  }
  return MILESTONES[MILESTONES.length - 1].km;
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 1_000) return `${km < 100 ? km.toFixed(1) : Math.round(km)} km`;
  if (km < 1_000_000) return `${Math.round(km).toLocaleString("en-US")} km`;
  if (km < 1_000_000_000) return `${(km / 1_000_000).toFixed(km < 10_000_000 ? 1 : 0)}M km`;
  return `${(km / 1_000_000_000).toFixed(1)}B km`;
}

/** The last milestone at or below this score — what the HUD names as "where you are". */
export function milestoneForScore(score: number): Milestone {
  let m = MILESTONES[0];
  for (const x of MILESTONES) if (x.at <= score) m = x;
  return m;
}
