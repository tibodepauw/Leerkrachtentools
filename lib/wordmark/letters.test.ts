import { describe, expect, it } from "vitest";
import {
  orbitOffset,
  scatterOffset,
  WORDMARK_LETTERS,
} from "@/lib/wordmark/letters";

describe("wordmark letters", () => {
  it("spelt Leerkrachtentools in 17 glyphs", () => {
    expect(WORDMARK_LETTERS.map((letter) => letter.char).join("")).toBe(
      "Leerkrachtentools",
    );
  });

  it("geeft deterministische scatter en orbit offsets", () => {
    const final = WORDMARK_LETTERS[0];
    const scatter = scatterOffset(0);
    const orbit = orbitOffset(0, final, scatter);

    expect(scatter.xEm).not.toBe(final.xEm);
    expect(orbit.xEm).not.toBe(scatter.xEm);
    expect(scatterOffset(0)).toEqual(scatterOffset(0));
  });
});
