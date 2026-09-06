import { describe, expect, it } from "vitest";
import {
  compactGatherScatter,
  ltGatherScatter,
  LT_WORDMARK_LETTERS,
  scatterOffset,
  WORDMARK_LETTERS,
} from "@/lib/wordmark/letters";

describe("compactGatherScatter", () => {
  it("anchors scatter near each letter instead of the viewport center", () => {
    for (let index = 0; index < WORDMARK_LETTERS.length; index += 1) {
      const final = WORDMARK_LETTERS[index];
      const compact = compactGatherScatter(index, final);
      const full = scatterOffset(index);
      const compactDistance = Math.hypot(compact.xEm - final.xEm, compact.yEm - final.yEm);
      const fullDistance = Math.hypot(full.xEm, full.yEm);
      expect(compactDistance).toBeLessThan(1.2);
      expect(compactDistance).toBeLessThan(fullDistance);
    }
  });
});

describe("LT_WORDMARK_LETTERS", () => {
  it("is gather LT, geen volledige wordmark", () => {
    expect(LT_WORDMARK_LETTERS.map((letter) => letter.char).join("")).toBe("LT");
    expect(LT_WORDMARK_LETTERS[0].rotateDeg).toBe(-12);
    expect(LT_WORDMARK_LETTERS[1].rotateDeg).toBe(12);
  });
});

describe("ltGatherScatter", () => {
  it("houdt L links en T rechts, dicht bij hun eindplek", () => {
    const left = LT_WORDMARK_LETTERS[0];
    const right = LT_WORDMARK_LETTERS[1];
    const scatterL = ltGatherScatter(0, left);
    const scatterT = ltGatherScatter(1, right);
    expect(scatterL.xEm).toBeLessThan(left.xEm);
    expect(scatterT.xEm).toBeGreaterThan(right.xEm);
    expect(scatterL.xEm).toBeLessThan(0);
    expect(scatterT.xEm).toBeGreaterThan(0);
    expect(Math.hypot(scatterL.xEm - left.xEm, scatterL.yEm - left.yEm)).toBeLessThan(0.25);
    expect(Math.hypot(scatterT.xEm - right.xEm, scatterT.yEm - right.yEm)).toBeLessThan(0.25);
  });
});
