import { describe, expect, it } from "vitest";
import {
  compactGatherScatter,
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
