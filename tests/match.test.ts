import { describe, expect, it } from "vitest";
import { buildIndex, matchAnswer } from "@/lib/game/match";
import type { PromptContent } from "@/lib/game/types";

const prompt: PromptContent = {
  id: "p1",
  text: "Name a magazine",
  answers: [
    { answer: "Popular Electronics", aliases: ["Popular Electronics Magazine"], tier: "apogee", quip: "q" },
    { answer: "Time", tier: "paper" },
    { answer: "Cricket", tier: "orbit" },
    { answer: "The Economist", tier: "jet" },
    { answer: "Côte d'Ivoire", tier: "orbit" },
  ],
};
const index = buildIndex(prompt);

describe("matchAnswer", () => {
  it("matches exact, cased, punctuated and article-less forms", () => {
    expect(matchAnswer(index, "time")?.entry.answer).toBe("Time");
    expect(matchAnswer(index, "TIME!")?.entry.answer).toBe("Time");
    expect(matchAnswer(index, "Economist")?.entry.answer).toBe("The Economist");
  });
  it("matches aliases and accents", () => {
    expect(matchAnswer(index, "popular electronics magazine")?.entry.answer).toBe("Popular Electronics");
    expect(matchAnswer(index, "cote divoire")?.entry.answer).toBe("Côte d'Ivoire");
  });
  it("forgives a typo on longer words but not short ones", () => {
    expect(matchAnswer(index, "cricet")?.distance).toBe(1);
    expect(matchAnswer(index, "Tme")).toBeNull();
  });
  it("misses nonsense", () => {
    expect(matchAnswer(index, "nonsense")).toBeNull();
    expect(matchAnswer(index, "   ")).toBeNull();
  });
});

describe("word-overlap fallback", () => {
  const films: PromptContent = {
    id: "p3",
    text: "Name a Best Picture winner",
    answers: [
      { answer: "One Flew Over the Cuckoo's Nest", aliases: ["Cuckoo's Nest"], tier: "jet" },
      { answer: "The Lord of the Rings: The Return of the King", aliases: ["Return of the King"], tier: "jet" },
      { answer: "The Godfather", tier: "paper" },
      { answer: "The Godfather Part II", tier: "jet" },
      { answer: "No Country for Old Men", tier: "jet" },
      { answer: "Mexico City", tier: "orbit" },
    ],
  };
  const idx = buildIndex(films);
  it("accepts a near-title with most of the words present", () => {
    expect(matchAnswer(idx, "a bird flew over the cuckoo's nest")?.entry.answer).toBe("One Flew Over the Cuckoo's Nest");
    expect(matchAnswer(idx, "no country for old man")?.entry.answer).toBe("No Country for Old Men");
    expect(matchAnswer(idx, "lord of the rings return of the king")?.entry.answer).toBe(
      "The Lord of the Rings: The Return of the King",
    );
  });
  it("prefers the more specific answer when both are fully covered", () => {
    expect(matchAnswer(idx, "godfather part 2 ii")?.entry.answer).toBe("The Godfather Part II");
  });
  it("does not match on filler words or half an answer", () => {
    expect(matchAnswer(idx, "of the")).toBeNull();
    expect(matchAnswer(idx, "mexico")).toBeNull();
    expect(matchAnswer(idx, "the old men")).toBeNull();
  });
  it("does not let a long paste fish for a match", () => {
    expect(matchAnswer(idx, "one flew over the cuckoo's nest and also the godfather and many more words here")).toBeNull();
  });
});
