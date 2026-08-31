import { describe, expect, it } from "vitest";
import { chaosBurstOffset } from "@/lib/wordmark/letters";

describe("chaosBurstOffset", () => {
  it("returns deterministic offsets for the same seed", () => {
    expect(chaosBurstOffset(0, 42)).toEqual(chaosBurstOffset(0, 42));
    expect(chaosBurstOffset(3, 42)).not.toEqual(chaosBurstOffset(0, 42));
  });

  it("changes direction when the seed changes", () => {
    expect(chaosBurstOffset(2, 1)).not.toEqual(chaosBurstOffset(2, 2));
  });
});
