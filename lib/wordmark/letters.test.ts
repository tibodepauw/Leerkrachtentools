import { describe, expect, it } from "vitest";
import { compactScatterOffset, scatterOffset } from "@/lib/wordmark/letters";

describe("compactScatterOffset", () => {
  it("keeps scatter tighter than the full-screen gather motion", () => {
    for (let index = 0; index < 17; index += 1) {
      const full = scatterOffset(index);
      const compact = compactScatterOffset(index);
      const fullRadius = Math.hypot(full.xEm, full.yEm);
      const compactRadius = Math.hypot(compact.xEm, compact.yEm);
      expect(compactRadius).toBeLessThan(fullRadius);
    }
  });
});
