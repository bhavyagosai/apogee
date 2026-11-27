import { describe, expect, it } from "vitest";
import { editDistance, normalize, toleranceFor } from "@/lib/game/normalize";

describe("normalize", () => {
  it("folds case, accents, punctuation and articles", () => {
    expect(normalize("The New Yorker!")).toBe("new yorker");
    expect(normalize("Café & Co.")).toBe("cafe and co");
    expect(normalize("  A  Tagus ")).toBe("tagus");
    expect(normalize("Côte d’Ivoire")).toBe("cote divoire");
  });
  it("returns empty for nothing useful", () => {
    expect(normalize("!!!")).toBe("");
  });
});

describe("editDistance", () => {
  it("counts substitutions, insertions and transpositions", () => {
    expect(editDistance("halloumi", "haloumi", 2)).toBe(1);
    expect(editDistance("sea monkey", "sea donkey", 2)).toBe(1);
    expect(editDistance("magneta", "magenta", 2)).toBe(1);
    expect(editDistance("abc", "xyz", 2)).toBeGreaterThan(2);
  });
  it("tolerates more typos on longer keys", () => {
    expect(toleranceFor("abc")).toBe(0);
    expect(toleranceFor("abcde")).toBe(1);
    expect(toleranceFor("abcdefgh")).toBe(2);
  });
});
