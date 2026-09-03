import { describe, expect, it } from "vitest";
import { setIndexedValue } from "@/lib/ui/indexedValues";

describe("setIndexedValue", () => {
  it("schrijft in het gevraagde index, ook als de array nog leeg is", () => {
    expect(setIndexedValue([], 1, "tweede")).toEqual(["", "tweede"]);
    expect(setIndexedValue(["eerste"], 1, "tweede")).toEqual([
      "eerste",
      "tweede",
    ]);
  });

  it("overschrijft een bestaande waarde zonder andere slots te wijzigen", () => {
    expect(setIndexedValue(["a", "b"], 0, "x")).toEqual(["x", "b"]);
  });
});
