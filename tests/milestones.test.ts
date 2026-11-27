import { describe, expect, it } from "vitest";
import { MILESTONES, formatKm, kmForScore, milestoneForScore } from "@/lib/game/milestones";
import { MAX_SCORE, debriefFor } from "@/lib/game/tiers";

describe("milestones", () => {
  it("are strictly increasing in both score and distance", () => {
    for (let i = 1; i < MILESTONES.length; i++) {
      expect(MILESTONES[i].at).toBeGreaterThan(MILESTONES[i - 1].at);
      expect(MILESTONES[i].km).toBeGreaterThan(MILESTONES[i - 1].km);
    }
    expect(MILESTONES[MILESTONES.length - 1].at).toBe(MAX_SCORE);
  });
  it("hits each milestone exactly and interpolates between", () => {
    for (const m of MILESTONES) expect(kmForScore(m.at)).toBe(m.km);
    expect(kmForScore(5)).toBeCloseTo(0.415, 3);
    const mid = kmForScore(285);
    expect(mid).toBeGreaterThan(384_400);
    expect(mid).toBeLessThan(1_500_000);
  });
  it("clamps out-of-range scores", () => {
    expect(kmForScore(-5)).toBe(0);
    expect(kmForScore(9999)).toBe(MILESTONES[MILESTONES.length - 1].km);
  });
  it("names where you are", () => {
    expect(milestoneForScore(0).label).toBe("T-minus zero");
    expect(milestoneForScore(275).label).toMatch(/MOON/);
  });
  it("formats distances for humans", () => {
    expect(formatKm(0.83)).toBe("830 m");
    expect(formatKm(12)).toBe("12.0 km");
    expect(formatKm(384_400)).toBe("384,400 km");
    expect(formatKm(55_000_000)).toBe("55M km");
    expect(formatKm(24_000_000_000)).toBe("24.0B km");
  });
});

describe("debrief bands", () => {
  it("cover every score without gaps", () => {
    for (let s = 0; s <= MAX_SCORE; s++) expect(debriefFor(s)).toBeDefined();
    expect(debriefFor(150).name).toBe("Suborbital");
    expect(debriefFor(151).name).toBe("Low orbit");
    expect(debriefFor(450).name).toBe("Interstellar");
  });
});
